import { URL } from "../models/url.model.js";

const handleEditURL = async (req, res) => {
    const { shortId } = req.params;
    const { changeId } = req.body;

    try {
        // Check if changeId is provided
        if (!changeId) {
            return res.status(400).send({ error: "Provide the change text" });
        }

        // Find and update the URL document by shortId
        const updatedUrl = await URL.findOneAndUpdate(
            { shortId }, // Filter
            { shortId: changeId }, // Update operation
            { new: true, useFindAndModify: false } // Options: return the updated document
        );

        // Check if the URL was found and updated
        if (!updatedUrl) {
            return res.status(404).send({ error: "This URL is not present" });
        }

        // Send a successful response
        res.status(200).send({ updatedUrl });
    } catch (error) {
        console.error("Error while updating the URL:", error);
        res.status(500).send({ error: "Internal Server Error" });
    }
};

export { handleEditURL };
