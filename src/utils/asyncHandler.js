const asyncHandler = (requestHandler) => {
  (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };

//Here we make asyncHandler a higher order function which can take function as a parameter or return
//value as a function

// const asyncHandler=()=>{}
// const asyncHandler=(func)=>{()=>{}} And if we want to make it async we can write like below
//const asyncHandler=(func)=>async()=>{}

//This asyncHandler is made up of try catch block.But we can make it through a promise also.
// const asyncHandler=(fn)=>async(req,res,next)=>{     //This is similar to above line. We just remove the braces.
//     try {
//         await fn(req,res,next)
//     } catch (error) {
//         res.status(err.code || 500).json({
//             success:false,
//             message:error.message
//         })
//     }
// }
