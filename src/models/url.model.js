import mongoose from "mongoose";

const urlSchema = new mongoose.Schema(
    {
        shortId:{
            type:String,
            required: true,
            unique:true
        },
        redirectURL:{
            type:String,
            required:true
        },
        createdBy :{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
            required:true
        }
        ,
        visitHistory:[{
            timestamp:{type:Number}}],
            
    },
    {timestamps:true}
);


const URL = mongoose.model("url",urlSchema);

export {URL}
