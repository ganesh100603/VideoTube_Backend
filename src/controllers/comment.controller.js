import mongoose,{Schema} from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { Comment } from "../models/comment.models.js";
import { Video } from "../models/video.models.js";
import { Like } from "../models/like.models.js";

const getVideoComments = asyncHandler(async(req,res)=>{
    const {videoId} = req.params
    const {page=1,limit=10} = req.query

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404,"video not found")
    }

    const commentAggregate =  Comment.aggregate(
        [
            {
                $match:{
                    video:new mongoose.Types.ObjectId(videoId)
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
                $lookup:{
                    from:"likes",
                    localField:"_id",
                    foreignField:"comment",
                    as:"likes"
                }
            },
            {
                $addFields:{
                   id:"$_id",
                    likescount:{
                        $size:"$likes"
                    },
                    owner:{
                        $first:"$owner"
                    },
                    isLiked:{
                        $cond:{
                            if:{
                                $in:[req.user?._id,"$likes.likedBy"]
                            },
                            then:true,
                            else:false
                        }
                    }
                }   
            },
            {
                $sort:{
                    createdAt:-1
                }
            },
            {
                $project:{
                    content:1,
                    createdAt:1,
                    likescount:1,
                    owner:{
                        fullname:1,
                        username:1,
                        avatar:1
                    },
                    isLiked:1
                }
            }
        ]
    )

    const options={
        page:parseInt(page,10),
        limit:parseInt(limit,10)
    }

    const comments = await Comment.aggregatePaginate(commentAggregate,options)

    return res
    .status(200)
    .json(new ApiResponse(200,comments,"Comments fetched successfully"))
})

const addComment = asyncHandler(async(req,res)=>{
    const {videoId} = req.params
    const {content} = req.body

    if(!content){
        throw new ApiError(400,"Content is required")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404,"Video not found")
    }

    const comment = await Comment.create({
        content,
        video:videoId,
        owner:req.user?._id,
    }).then((c=>c.populate("owner","username _id")))

    if(!comment){
        throw new ApiError(500,"Failed to add comment please try again!")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,comment,"Comment added successfully"))
})

const updateComment = asyncHandler(async(req,res)=>{
    const {commentId} = req.params
    const {content} = req.body

    if(!content){
        throw new ApiError(400,"Content is required")
    }

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(404,"Comment not found")
    }

    if(comment?.owner.toString()!==req.user?._id.toString()){
        throw new ApiError(400,"only comment owner can edit their comment")
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        comment?._id,
        {
            $set:{
                content
            }
        },
        {
            new:true
        }
    )

    if(!updatedComment){
        throw new ApiError(500,"Failed to update the comment please try again!")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,updatedComment,"Comment is updated successfully"))
})

const deleteComment = asyncHandler(async(req,res)=>{
    const {commentId} = req.params

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(404,"Comment not found")
    }

    if(comment?.owner.toString()!==req.user._id.toString()){
        throw new ApiError(400,"only comment owner can delete their comment")
    }

    await Comment.findByIdAndDelete(commentId)

    await Like.deleteMany(
        {
            comment:commentId,
            likedBy:req.user
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200,{commentId},"Comment deleted successfully"))
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}