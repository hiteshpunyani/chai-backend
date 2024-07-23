import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";

const generateAccessAndRefreshToken=async(userId)=>{
  try{
    const user=await User.findById(userId);
    const accessToken= user.generateAccessToken();
    const refreshToken=user.generateRefreshToken();

    user.refreshToken=refreshToken;
    await user.save({ValidateBeforeSave:false }); //validatebeforesave is used as all the fields of model gets triggered and try to validate all the field while saving the user. 
    
    return {accessToken,refreshToken};

  }catch(error){
    throw new ApiError(500,"Something went wrong while generating tokens")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  //get details from frontend
  //validation-not empty
  //check if user is already exists:by email or username
  //check for images,check for avatar
  //upload them to cloudinary,avatar
  //create user object-create entry in db
  //remove password and refreshToken field from response
  //check for user creation
  //return res

  const { fullName, email, username, password } = req.body;
  // console.log("email:", email);

  // if(fullName === ""){
  //     throw new ApiError(400,"fullName is required");
  // }

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already existed");
  }
  // console.log(req.files);

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //req body->data.
  //username or email
  //find the user
  //check the password
  //generate access and refresh tokens
  //send cookies(will send tokens in cookies form)

  const {email,username,password}=req.body;

  if(!username && !email){
    throw new ApiError(400,"username or email is required");
  }

  const user=await User.findOne({
    $or:[{username},{email}]
  })

  if(!user){
    throw new ApiError(404,"User does not exist");
  }

  const isPasswordValid=await user.isPasswordCorrect(password);

  if(!isPasswordValid){
    throw new ApiError(401,"Invalid User credentials");
  }

  const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id);

  const loggedInUser=await User.findById(user._id).
  select("-password,-refreshToken");

  const options={
    httpOnly:true,
    secure:true
  }

  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,
      {
        user:loggedInUser,accessToken,refreshToken
      },
      "User logged In successfully"
    )
  )

});

const logoutUser=asyncHandler(async(req,res)=>{
  //find user
  //clear cookies
  //clear refreshToken

  await User.findByIdAndUpdate(
    req.user._id,{
      $unset:{
        refreshToken:1 //this removes field from the document
      }
    },
    {
      new:true
    }
  )

  const options={
    httpOnly:true,
    secure:true
  }

  return res.status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200,{},"User Logged Out"))
  
})

const refreshAccessToken=asyncHandler(async(req,res)=>{
  const incomingrefreshToken=req.cookies.refreshToken || req.body.refreshToken;

  if(!incomingrefreshToken){
    throw new ApiError(401,"Unauthorized request");
  }

  try {
    const decodedToken=jwt.verify(incomingrefreshToken,process.env.REFRESH_TOKEN_SECRET);

  const user=await User.findById(decodedToken?._id);

  if(!user){
    throw new ApiError(401,"Invalid refresh Token");
  }

  if(incomingrefreshToken !== user?.refreshToken){
    throw new ApiError(401,"Refresh Token is expired or used");
  }

  const options={
    httpOnly:true,
    secure:true
  }
  
  const {accessToken,newRefreshToken}=await generateAccessAndRefreshToken(user?._id);

  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",newRefreshToken,options)
  .json(
    new ApiResponse(
      200,
      {accessToken,refreshToken:newRefreshToken},
      "Access Token is refreshed"
      )
  )
  } catch (error) {
    throw new ApiError(401,error?.message || "Invalid Refresh Token");
  }

})

const changeCurrentPassword=asyncHandler(async(req,res)=>{
  const {oldPassword,newPassword}=req.body;

  const user=await User.findById(req.user?._id);
  const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid old password");
  }

  user.password=newPassword;

  await user.save({ValidateBeforeSave:false})

  return res
  .status(200)
  .json(new ApiResponse(200,{},"Password changed Successfully"));
})

const getCurrentUser=asyncHandler(async(req,res)=>{

  return res
  .status(200)
  .json(200,req.user,"Current User fetched successfully");
})

const updateAccountDetails=asyncHandler(async(req,res)=>{
  const {fullName,email} = req.body;

  if(!fullName || !email){
    throw new ApiError(400,"All fields are required");
  }

  User.findByIdAndUpdate(req.user?._id,
    {
      $set:{
        fullName,
        email:email
      }
    },
    {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar=asyncHandler(async(req,res)=>{
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is missing")
  }

  const avatar=await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400,"Error while uploading on cloudinary")
  }

  const user = await User.findByIdAndUpdate(
    req.body?._id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated Successfully!!"))
})

const updateUsercoverImage=asyncHandler(async(req,res)=>{
  const coverImageLocalPath = req.file?.path
 
  if(!coverImageLocalPath){
    throw new ApiError(400,"coverImage file is missing")
  }

  const coverImage=await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
    throw new ApiError(400,"Error while uploading on cloudinary")
  }

  const user = await User.findByIdAndUpdate(
    req.body?._id,
    {
      $set:{
        coverImage:coverImage.url
      }
    },
    {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"coverImage updated successfully"));
})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
  const {username} = req.params

  if(!username?.trim()){
    throw new ApiError(400,"Username is missing")
  }

  // User.find({username})
  // will use mongoDb aggregation pipeline to find user document.
  const channel = await User.aggregate([
    {
      $match:{
        username:username?.toLowerCase()
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
        channelsSubscribedToCount:{
          $size:"$subscribedTo"
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
        fullName:1,
        username:1,
        subscribersCount:1,
        channelsSubscribedToCount:1,
        isSubscribed:1,
        avatar:1,
        coverImage:1,
        email:1,
      }
    }
  ])

  if(!channel?.length){
    throw new ApiError(400,"Channel does not exist");
  }

  return res
  .status(200)
  .json(new ApiResponse(200,channel[0],"User Channel fetched successfully"))
})

const getWatchHistory= asyncHandler(async(req,res)=>{
    const user=await User.aggregate([
      {
        $match:{
          // _id:req.user._id  this is wrong as the code inside the aggregation pipeline goes straight to the database.It does not handle by mongoose.
          //Otherwise mongoose has the capability to turn the string into mongodb objectId.
          _id:new mongoose.Types.ObjectId(req.user._id)
        }
      },
      {
        $lookup:{
          from:"videos",
          localField:"watchHistory",
          foriegnField:"_id",
          as:"watchHistory",
          pipeline:[
            {
              $lookup:{
                  from:"users",
                  localField:"owner",
                  foriegnField:"_id",
                  as:"owner",
                  pipeline:[
                    {
                      $project:{
                        fullName:1,
                        userName:1,
                        avatar:1,
                      }
                    }
                  ]
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
    ])

    return res
    .status(200)
    .json(new ApiResponse(200,user[0].watchHistory,"Watch History fetched successfully!!"))
})

export { 
  registerUser, 
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUsercoverImage,
  getUserChannelProfile,
  getWatchHistory
};
