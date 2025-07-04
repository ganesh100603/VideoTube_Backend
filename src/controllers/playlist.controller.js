import mongoose, { isValidObjectId } from "mongoose";
import {Playlist} from "../models/playlist.models.js"
import {Video} from "../models/video.models.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

const createPlaylist = asyncHandler(async(req,res)=>{
    const {name,description} = req.body

    if(!name || !description){
        throw new ApiError(400,"name and description both are required")
    }

    const playlist = await Playlist.create(
        {
            name,
            description,
            owner:req.user?._id
        }
    )

    if(!playlist){
        throw new ApiError(500,"Failed to create a playlist")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,playlist,"Playlist created successfully"))
})

const updatePlaylist = asyncHandler(async(req,res)=>{
    const {name,description} = req.body
    const {playlistId} = req.params

    if(!name||!description){
        throw new ApiError(400,"name and description both are required")
    }

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400,"Invalid PlaylistId")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(400,"Playlist not found")
    }

    if(playlist.owner?.toString()!== req.user?._id.toString()){
        throw new ApiError(400,"only owner can edit the playlist")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlist?._id,
        {
            $set:{
                name,
                description
            }
        },
        {new:true}
    )

    if(!updatedPlaylist){
        throw new ApiError(500,"Failed to update the playlist")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,updatedPlaylist,"Playlist updated successfully"))
})

const deletePlaylist = asyncHandler(async(req,res)=>{
    const {playlistId} = req.params
    if(!isValidObjectId(playlistId)){
        throw new ApiError(400,"Invalid PlaylistId")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(404,"Playlist not found")
    }

    if(playlist.owner?.toString()!== req.user?._id.toString()){
        throw new ApiError(400,"Plylist can be deleted by owner only")
    }

    await Playlist.findByIdAndDelete(playlist?._id)

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Playlist deleted successfully"))
})

const addVideoToPlaylist = asyncHandler(async(req,res)=>{
    const {videoId,playlistId} = req.params

    if(!isValidObjectId(videoId) || !isValidObjectId(playlistId)){
        throw new ApiError(400,"Invalid videoId or PlaylistId")
    }

    const playlist = await Playlist.findById(playlistId)
    const video = await Video.findById(videoId)

    
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }
    if (!video) {
        throw new ApiError(404, "video not found");
    }

    if((playlist.owner?.toString() && video.owner?.toString())!== req.user?._id.toString()){
        throw new ApiError(400,"only owner can add video to their playlist")
    }

    const updatedPlaylist = await Playlist.findOneAndUpdate(
        playlist?._id,
        {
            $addToSet:{
                videos:videoId
            }
        },
        {new:true}
    )

    if(!updatedPlaylist){
        throw new ApiError(500,"Failed to add video into your playlist please try again")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,updatedPlaylist,"Added video into playlist successfully"))
})

const removeVideoPlaylist = asyncHandler(async(req,res)=>{
    const {videoId,playlistId} = req.params

    if(!isValidObjectId(videoId) || !isValidObjectId(playlistId)){
        throw new ApiError(400,"Invalid videoId or PlaylistId")
    }

    const playlist = await Playlist.findById(playlistId)
    const video = await Video.findById(videoId)

    
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }
    if (!video) {
        throw new ApiError(404, "video not found");
    }

    if((playlist.owner?.toString() && video.owner?.toString())!== req.user?._id.toString()){
        throw new ApiError(400,"only owner can remove video from their playlist")
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull:{
                videos:videoId
            }
        },
        {
            new:true
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200,updatedPlaylist,"Deleted video from playlist succesfully"))
})

const getPlaylistById = asyncHandler(async(req,res)=>{
    const {playlistId} = req.params

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400,"Invalid PlaylistId")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(404,"Playlist not found")
    }

    const playlistVideos = await Playlist.aggregate(
        [
            {
                $match:{
                    _id:new mongoose.Types.ObjectId(playlistId)
                }
            },
            {
                $lookup:{
                    from:"videos",
                    localField:"videos",
                    foreignField:"_id",
                    as:"videos"
                }
            },
            {
                $match:{
                    "videos.isPublished":true
                }
            },
            {
                $lookup:{
                    from:"users",
                    localField:"owner",
                    foreignField:"_id",
                    as:"owner"
                }
            },
            {
                $addFields:{
                    totalVideos:{
                        $size:"$videos"
                    },
                    totalViews:{
                        $sum:"$videos.views"
                    },
                    owner:{
                        $first:"$owner"
                    }
                }
            },
            {
                $project:{
                    name:1,
                    description:1,
                    createdAt:1,
                    updatedAt:1,
                    totalViews:1,
                    totalVideos:1,
                    videos:{
                        _id:1,
                        "videoFile.url":1,
                        "thumbnail.url":1,
                        title:1,
                        description:1,
                        duration:1,
                        createdAt:1,
                        views:1
                    },
                    owner:{
                        username:1,
                        fullname:1,
                        avatar:1
                    }
                }
            }
        ]
    )
    return res
    .status(200)
    .json(new ApiResponse(200,playlistVideos,"Playlist fetched successfully"))
})

const getUserPlaylist = asyncHandler(async(req,res)=>{
    const {userId} = req.params
    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invaild UserId")
    }

    const playlists = await Playlist.aggregate(
        [
            {
                $match:{
                    owner: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $lookup:{
                    from:"videos",
                    localField:"videos",
                    foreignField:"_id",
                    as:"videos"
                }
            },
            {
                $addFields:{
                    totalVideos:{
                        $size:"$videos"
                    },
                    totalViews:{
                        $sum:"$videos.views"
                    }
                }
            },
            {
                $project:{
                    _id:1,
                    name:1,
                    description:1,
                    totalViews:1,
                    totalVideos:1,
                    updatedAt:1
                }
            }
        ]
    )

    return res
    .status(200)
    .json(new ApiResponse(200,playlists,"User playlist fetched successfully"))
})

export {
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addVideoToPlaylist,
    removeVideoPlaylist,
    getPlaylistById,
    getUserPlaylist
}