import {asynchandler} from "../utils/async-handler.js"
import { ApiResponse } from "../utils/Api-response.js";
import {ApiError} from "../utils/api-error.js"
import {User} from "../models/user.models.js"
import { deleteFromClodinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
    
        if(!user){
            return res.status(404).json(new ApiError(404, "user not found"))
        }
    
        const accessToken = user.generateAcessToken()
        const refreshToken = user.generateRefreshToken()
    
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access Token and refresh Token")
    }
}

const registerUser = asynchandler( async (req , res) => {
    const {fullname, email, username, password} = req.body || {};
    if(
        [fullname, username, email, password].some((field)=> !field || field.trim() === "")){
            throw new ApiError(400, "All fields are required")
        }
    
    const existedUser = await User.findOne({
        $or: [{username} , {email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverLocalPath = req.files?.coverImage?.[0]?.path

    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is missing");
    }

    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath)
        console.log("uploaded avatar",avatar);
    } catch (error) {
        console.log("Error uploading avatar",error) 
        throw new ApiError(500,"Failed to upload avatar")
    }

     let coverImage;
    try {
       coverImage = await uploadOnCloudinary(coverLocalPath);
       console.log("uploaded coverImage", coverImage);
    } catch (error) {
       console.log("Error uploading coverImage", error);
       throw new ApiError(500, "Failed to upload coverImage");
    }

    try {
        const user = await User.create({
            fullname : fullname,
            email : email,
            password : password,
            username : username,
            avatar : avatar.url,
            coverImage : coverImage.url
        })

        await user.save()

        const createdUser = await User.findById(user._id).select("-password -refreshToken");
    
        if(!createdUser){
            throw new ApiError(500, "Something went wrong while registering a user")
        }
    
        return res.status(201)
        .json(new ApiResponse(201, createdUser, "User registered successfully"))
    } catch (error) {
        console.log("User Creation failed")

        if(avatar){
            await deleteFromClodinary(avatar.public_id)
        }
        if(coverImage){
            await deleteFromClodinary(coverImage.public_id)
        }

        throw new ApiError(500,"Something went wrong while registering a user and images were deleted")
    }

})

const loginUser = asynchandler(async (req,res)=> {
    const {username, email, password} = req.body

    if(!email || !password){
        return res.status(400).json(new ApiError(400,"Email or password is missing"))
    }

    const user = await User.findOne({
        $or: [{username} , {email}]
    })

    if(!user){
        throw new ApiError(404,"User not found")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if(!isPasswordCorrect){
        return res.status(400).json(new ApiError(400, "Invalid credentials"))
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id)
    .select(" -password -refreshToken");

    if(!loggedInUser){
        return res.status(401).json(new ApiError(401, "user is not logged in kindly log in!"))
    }

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(
        200, 
        {user : loggedInUser, accessToken, refreshToken}
        , "User logged in successfully"))
})

const logoutUser = asynchandler( async (req,res)=> {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            }
        },
        {new : true}
    )

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"))


})

const refreshAccessToken = asynchandler( async (req,res)=> {
    const incomingRefreshToken = req.cookies.refreshToken|| req.body.refreshToken

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
            return res.status(401).json(new ApiError(401,"Invalid refresh token"))
        }

        if(incomingRefreshToken !== user?.refreshToken){
            return res.status(401).json(new ApiError(401,"Invalid refresh token"))
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        }

        const {accessToken, refreshToken: newrefreshtoken} = await generateAccessAndRefreshToken(user._id)

        return res
        .status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken",newrefreshtoken, options)
        .json(new ApiResponse(
            200, 
            {accessToken,
                 refreshToken: newrefreshtoken}, 
            "Accesstoken refreshed succesfully"
        ));

    } catch (error) {
        throw new ApiError(500,"Something went wrong while refreshing access token")
    }

})

const changeCurrentPassword = asynchandler(async (req, res)=> {
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Old password is incorrect")
    }

    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asynchandler(async (req, res)=> {
    return res.status(200).json(new ApiResponse(200, req.user, "Current user details"))
})

const updateAccountDetails = asynchandler(async (req, res)=> {
    const {fullname, email} = req.body

    if(!fullname || !email){
        throw new ApiError(400, "Fullname or email is missing")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {new : true}
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asynchandler(async (req, res)=> {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "File is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(500, "Something went wrong while updating avatar")
    }

    const user = await user.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"))

})

const updateUserCoverImage = asynchandler(async (req, res)=> {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "File is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(500, "Something went wrong while uploading cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage = coverImage.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200, user, "Cover image updated successfully"))
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
    updateUserCoverImage
}