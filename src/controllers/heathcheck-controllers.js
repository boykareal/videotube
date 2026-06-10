import { ApiResponse } from "../utils/Api-response.js";
import {asynchandler} from "../utils/async-handler.js"

const healthcheck = asynchandler( async (req,res)=> {
    return res.status(200)
    .json(new ApiResponse(200,"OK", "health check passed"))
})


export {healthcheck}