import { asyncHandler } from "../utils/AsyncHandler.js";
import {ApiError} from  "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary,deleteFromCloudinary } from "../utils/cloudinary.js";
import jwt  from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async(useId)=>{
    try {
        const user = await User.findById(useId)
        if(!user){
            throw new ApiError(400,"User is not found")
        }
        const accessToken = user.generateAccesToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Somwthing went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async(req,res)=>{
    const{username,email,fullname,password}=req.body
    
    //validate
    if(
        [username,email,fullname,password].some((field)=> field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required")
    }

    //checking existed user
    const existedUser=await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exits")
    }

    const avatarLocalPath=req.files?.avatar?.[0]?.path
    const coverImageLocalPath=req.files?.coverImage?.[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    // const avatar= await uploadOnCloudinary(avatarLocalPath)
    // console.log("Avatar Upload Response:", avatar);


    // let coverImage=""
    // if(coverImageLocalPath){
    // coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // }

    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath)
    } catch (error) {
        console.log("Error uploading avatar" ,error)
        throw new ApiError(500, "Failed to upload avatar")
    }
    let coverImage;
    try {
        coverImage = await uploadOnCloudinary(coverImageLocalPath)
    } catch (error) {
        console.log("Error uploading coverImage" ,error)
        throw new ApiError(500, "Failed to upload coverImage")
    }

    try {
        const user = await User.create({
            fullname,
            avatar:avatar.url,
            coverImage:coverImage?.url || "",
            email,
            username:username.toLowerCase(),
            password
        })
    
        const createdUser = await User.findById(user._id).select("-password -refreshToken")
        if(!createdUser){
            throw new ApiError(500,"Somwthing went wrong while registring a user")
        }
    
        return res
        .status(200)
        .json(new ApiResponse(200,createdUser,"User registered succcessfully"))
    } catch (error) {
        console.log("User creation failed")
        if(avatar){
            await deleteFromCloudinary(avatar.public_id)
        }
        if(coverImage){
            await deleteFromCloudinary(coverImage.public_id)
        }
        throw new ApiError(500,"Somwthing went wrong  while regitsring a user and images were deleted")
    }
})

const loginUser = asyncHandler(async(req,res)=>{
    const{email,username,password} = req.body
    if(!(email || username)){
        throw new ApiError(500,"Email is required")
    }

    const user = await User.findOne({
        $or:[{email},{username}]
    })

    if(!user){
        throw new ApiError(500,"User was not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(500,"Invalid Credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken") 

    const options = {
        httpOnly:true,
        secure: true
    }

    return res
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(
        200,
        // loggedInUser,
        {user:loggedInUser, accessToken,refreshToken},
        // for mobile because in mobile we cannot
        //set cookies
        "User logged in successfully"))
})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {new:true}
    )
    const options = {
        httpOnly:true,
        secure: process.env.NODE_ENV === "production"
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"Refresh token is required")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"Invalid refresh Token")
        }

        const {accessToken,refreshToken:newRefreshToken} = await generateAccessAndRefreshToken(user._id)

        const options={
            httpOnly:true,
            secure:process.env.NODE_ENV === "production"
        }

        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(200,
            {
                accessToken,
                refreshToken: newRefreshToken
            },
            "Access token refreshed successfullly"
        ))

    } catch (error) {
       throw new ApiError(500,"Something went wrong while refreshing access token") 
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body
    
    const user = await User.findById(req.user?._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(401,"old password is incorrect")
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})
    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"current user details"))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname,email} = req.body
    if(!fullname || !email){
        throw new ApiError(400,"fullname and email is required")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{fullname,email}
        },
        {new:true}
    ).select("-password -refreshToken")
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Updated deatils successfully"))
})
const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(500,"Something went wrong while uploading the avatar")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(500,"Avatar URL is not found")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar is updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(500,"Something went wrong while uploading the coverImage")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(500,"CoverImage URL is not found")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"AvataCoverImage is updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params
    if(!username?.trim()){
        throw new ApiError(500,"Username is required")
    }

    const channel = await User.aggregate([
        {
            $match:{
                "username": username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedTo:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                    if:{$in:[ req.user?._id,"$subscribers.subscriber"]},
                    then:true,
                    else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username:1,
                avatar:1,
                subscribersCount:1,
                channelsSubscribedTo:1,
                isSubscribed:1,
                coverImage:1,
                email:1
            }
        }
    ]
)
if(!channel?.length){
    throw new ApiError(404,"Channel not found")
}
return res
.status(200)
.json(new ApiResponse(200,channel[0],"Channel profile fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user =await User.aggregate(
        [
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(req.user?._id)
                }
            },
            {
                $lookup:{
                    from:"videos",
                    localField:"watchHistory",
                    foreignField:"_id",
                    as:"watchHistory",
                    pipeline:[{
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[{
                                $project:{
                                    fullname:1,
                                    username:1,
                                    avatar:1
                                }
                            }]
                        }
                    },
                {
                    $addFields:{
                        owner:{
                            $first:"$owner"
                        }
                    }
                }
                ]
                }
            }
        ]
    )
    return res
    .status(200)
    .json(new ApiResponse(200,user[0].watchHistory,"Watch History fetched successfully"))
})

export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}