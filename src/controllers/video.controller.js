import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {Like} from "../models/like.models.js"
import {Comment} from "../models/comment.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/AsyncHandler.js"
import {uploadOnCloudinary,deleteFromCloudinary} from "../utils/cloudinary.js"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    const pipeline = []

    if(query){
        pipeline.push(
            {
                $search:{
                    index:"search-videos",
                    text:{
                        query:query,
                        path: ["title","description"]
                    }
                }
            }
        )
    }
    
    if(userId){
        if(!isValidObjectId(userId)){
            throw new ApiError(400,"Invalid userId")
        }
        
        pipeline.push(
            {
                $match:{
                    owner: new mongoose.Types.ObjectId(userId)
                }
            }
        )
    }

    pipeline.push(
        {
            $match:{
                isPublished:true
            }
        }
    )

    if(sortBy&&sortType){
        pipeline.push(
            {
                $sort:{
                    [sortBy]:sortType==="asc"? 1 : -1
                }
            }
        )
    }else{
        pipeline.push(
            {
                $sort:{
                    createdAt:-1
                }
            }
        )
    }

    pipeline.push(
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"ownerDetails",
                pipeline:[
                    {
                        $project:{
                            username:1,
                            avatar:1
                        }
                    }
                ]
            }
            
        },
        {
            $unwind:"$ownerDetails"
        }
    )

    const videoAggregate = Video.aggregate(pipeline)

    const options = {
        page:parseInt(page,10),
        limit:parseInt(limit,10)
    }

    const video = await Video.aggregatePaginate(videoAggregate,options)

    return res
    .status(200)
    .json(new ApiResponse(200,video,"Videos fetched successfully"))
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }
    const videoLocalPath =  req.files?.videoFile?.[0].path
    const thumbnailLocalPath = req.files?.thumbnail?.[0].path

    let video;
    try {
        video = await uploadOnCloudinary(videoLocalPath)
    } catch (error) {
        throw new ApiError(404,"Error while uploading the video")
    }
    let thumbnail;
    try {
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    } catch (error) {
        throw new ApiError(404,"Error while uploading the thumbnail")
    }

    if(!video.url || !thumbnail.url){
        throw new ApiError(500,"Cloud upload failed")
    }

    const newVideo = await Video.create({
        title,
        description,
        duration: video.duration,
        videoFile: {
            url: video.url,
            public_id: video.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        owner: req.user?._id,
        isPublished: false
    })

    const videoUploaded = await Video.findById(newVideo._id);

    if (!videoUploaded) {
        throw new ApiError(500, "videoUpload failed please try again !!!");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,newVideo,"Video is published successfully")
    )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if(!isValidObjectId(videoId)){
        throw new ApiError(404,"Video Id was not found")
    }

    if(!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid userId");
    }

    const video = await Video.aggregate(
        [
            {
                $match:{
                    _id:new mongoose.Types.ObjectId(videoId)
                }
            },
            {
                $lookup:{
                    from:"likes",
                    localField:"_id",
                    foreignField:"video",
                    as:"likes"
                }
            },
            {
                $lookup:{
                    from:"users",
                    localField:"owner",
                    foreignField:"_id",
                    as:"owner",
                    pipeline:[
                        {
                            $lookup:{
                                from:"subscriptions",
                                localField:"_id",
                                foreignField:"channel",
                                as:"subscribers"
                            }
                        },
                        {
                            $addFields:{
                                subscribersCount:{
                                    $size:"$subscribers"
                                },
                                isSubscribed:{
                                    $cond:{
                                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                                        then:true,
                                        else:false
                                    }
                                }
                            }
                        },
                        {
                            $project:{
                                username:1,
                                avatar:1,
                                subscribersCount:1,
                                isSubscribed:1
                            }
                        }
                    ]
                }
            },
            {
                $addFields:{
                    likesCount:{
                        $size:"$likes"
                    },
                    owner:{
                        $first:"$owner"
                    },
                    isLiked:{
                        $cond:{
                            if:{$in:[req.user?._id,"$likes.likedBy"]},
                            then:true,
                            else:false
                        }
                    }
                }
            },
            {
                $project:{
                    "videoFile.url":1,
                    title:1,
                    description:1,
                    views:1,
                    createdAt:1, 
                    duration: 1,
                    comments: 1,
                    owner: 1,
                    likesCount: 1,
                    isLiked: 1
                }
            }
        ]
    )

    if(!video){
        throw new ApiError(500,"Failed to fetch video")
    }

    await Video.findByIdAndUpdate(videoId,{
        $inc:{
            views:1
        }
    })

    await User.findByIdAndUpdate(req.user?._id,{
        $addToSet:{
            watchHistory:videoId
        }
    })

    return res
    .status(200)
    .json(new ApiResponse(200,video,"Video is fetched successfully"))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const {title,description} = req.body
    const thumbnailLocalPath = req.file?.path
    //TODO: update video details like title, description, thumbnail
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invlaid VideoId")
    }
    if(!(title && description)){
        throw new ApiError(400,"title and description are required ")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404,"No video found")
    }

    if(video?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(400,"You are not authorize to edit this video")
    }

    const oldThumbnail = await video.thumbnail?.public_id

    let uploadThumbnail
    try {
        uploadThumbnail = await uploadOnCloudinary(thumbnailLocalPath) 
    } catch (error) {
        throw new ApiError(404,"Error while uploading the thumbnail")
    }

    if(!uploadThumbnail?.url){
        throw new ApiError(500,"Thumbnail url is not found")
    }
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                title,
                description,
                thumbnail:{
                    url:uploadThumbnail?.url,
                    public_id: uploadThumbnail?.public_id
                }
            }
        },
        {new:true}
    )

    if(!updatedVideo){
        throw new ApiError(404,"Video is not found")
    }

    if(updatedVideo){
        await deleteFromCloudinary(oldThumbnail)
    }

    return res
    .status(200)
    .json(new ApiResponse(200,updatedVideo,"Video's details are updated successfully"))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid VideoId")
    }

    const video = await Video.findById(videoId)

    if (!video) {
    throw new ApiError(404, "Video not found");
    }

    if(video?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(403,"You are not authorized to delete this video")
    }
    
    const deletedVideo = await Video.findByIdAndDelete(video?._id)
    if(!deleteVideo){
        throw new ApiError(400,"Failed to delete the video please try again")
    }

    await deleteFromCloudinary(video.thumbnail.public_id)
    await deleteFromCloudinary(video.videoFile.public_id,"video")
    
    await Like.deleteMany({
        video: videoId
    })

    await Comment.deleteMany(
        {
            video: videoId
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid VideoId")
    }

    const video = await Video.findById(videoId)

    if (!video) {
    throw new ApiError(404, "Video not found");
    }

    if(video.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(403,"You are not authorize owner of the video")
    }

    const toggleVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                isPublished : !video?.isPublished
            }
        },
        {new:true}
    )

    if(!toggleVideoPublish){
        throw new ApiError(500,"Failed to toggle video publish status")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,
        {isPublished:toggleVideoPublish.isPublished},
        "Video publish toggled successfully"))

})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}