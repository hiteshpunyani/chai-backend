import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
      $set:{
        refreshToken:undefined
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

export { 
  registerUser, 
  loginUser,
  logoutUser,
  refreshAccessToken

};
