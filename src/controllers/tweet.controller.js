import mongoose,{isValidObjectId} from "mongoose";
import {Tweet} from "../models/tweet.models.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

const createTweet = asyncHandler(async(req,res)=>{
    const {content} = req.body

    if(!content){
        throw new ApiError(400,"content is required")
    }

    let tweet = await Tweet.create(
        {
            content,
            owner:req.user?._id
        }
    )

    tweet = await tweet.populate("owner", "username avatar");

    if(!tweet){
        throw new ApiError(500,"Failed to create tweet please try again")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,tweet,"Tweet created successfully"))
})

const updateTweet = asyncHandler(async(req,res)=>{
    const {content} = req.body
    const {tweetId} = req.params

    if(!content){
        throw new ApiError(400,"content is required")
    }

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid TweetId")
    }

    const tweet = await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404,"Tweet not found")
    }

    if(tweet.owner?.toString()!==req.user?._id.toString()){
        throw new ApiError(400,"only owner can edit their tweet")
    }

    const newTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set:{
                content
            }
        },
        {new:true}
    )

    if(!newTweet){
        throw new ApiError(500,"Failed to update the tweet please try again")
    }

    return res 
    .status(200)
    .json(new ApiResponse(200,newTweet,"Tweet updated successfully"))
})

const deleteTweet = asyncHandler(async(req,res)=>{
    const {tweetId} = req.params

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid TweetId")
    }

    const tweet = await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(404,"Tweet not found")
    }

    if(tweet.owner?.toString()!==req.user?._id.toString()){
        throw new ApiError(400,"only owner can delete their tweet")
    }

    await Tweet.findByIdAndDelete(tweetId)

    return res
    .status(200)
    .json(new ApiResponse(200,{tweetId},"Tweet deleted successfully"))
})

const getUserTweets = asyncHandler(async(req,res)=>{
    const {userId} = req.params

    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invalid UserId")
    }

    const tweets = await Tweet.aggregate(
        [
            {
                $match:{
                    owner:new mongoose.Types.ObjectId(userId)
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
                            $project:{
                                username:1,
                                avatar:1
                            }
                        }
                    ]
                }
            },
            {
                $lookup:{
                    from:"likes",
                    localField:"_id",
                    foreignField:"tweet",
                    as:"likeDetails",
                    pipeline:[
                        {
                            $project:{
                                likedBy:1
                            }
                        }
                    ]
                }
            },
            {
                $addFields:{
                    likesCount:{
                        $size:"$likeDetails"
                    },
                    owner:{
                        $first:"$owner"
                    },
                    isLiked:{
                        $cond:{
                            if:{
                                $in:[req.user?._id,"$likeDetails.likedBy"]
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
                    owner:1,
                    likesCount:1,
                    createdAt:1,
                    isLiked:1
                }
            }

        ]
    )

    return res
    .status(200)
    .json(new ApiResponse(200,tweets,"User tweets fetched successfully"))
})

export {
    createTweet,
    updateTweet,
    deleteTweet,
    getUserTweets
}