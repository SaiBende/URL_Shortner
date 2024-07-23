import jwt from "jsonwebtoken";


const auth =async(req,res,next)=>{
    
    console.log(req.cookies);
    const {token}=req.cookies;
    if(!token){
        return res.status(401).json({message:"You are not logind"})
    }
    try {
        const decoded = jwt.verify(token,process.env.TOKEN_KEY);
        console.log(decoded,"auth middleware");
        req.user=decoded;

       

    } catch (error) {

        return res.status(401).json({message:"You are not authenticatedtry catch"})
        
    }
    return next();
}

export {auth}