import {asynchandler} from "../utils/async-handler.js"
import { ApiResponse } from "../utils/Api-response.js";
import {ApiError} from "../utils/api-error.js"
import {User} from "../models/user.models.js"
import { deleteFromClodinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";

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

export {
    registerUser
}