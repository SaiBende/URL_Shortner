import "./config/env.js"; // must be the first import so process.env is populated
import ConnectMongoDB from "./db/ConnectMongoDB.js";
import { app } from "./app.js";

ConnectMongoDB()
    .then(
        () => {
            app.listen(process.env.PORT || 8000, () => {
                console.log(`Server is running on port ${process.env.PORT || 8000}`);
            });
        }
    )
    .catch((err) => console.log(err));
