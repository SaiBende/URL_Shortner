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
        // Legacy timeline. New visits are written to the Visit collection and
        // this array is no longer updated, so it stays small and frozen.
        // `select: false` keeps it out of dashboard and hot-path queries.
        visitHistory: {
            type: [{
                timestamp: { type: Number },
            }],
            default: [],
            select: false,
        },
        // Fast counter for list views. Includes only visits recorded after the
        // Visit collection was introduced; the dashboard adds the legacy array.
        visitCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastVisitAt: {
            type: Date,
            default: null,
        },
    },
    {timestamps:true}
);

urlSchema.index({ createdBy: 1, createdAt: -1 });


const URL = mongoose.model("url",urlSchema);

export {URL}
