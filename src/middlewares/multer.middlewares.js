import multer from "multer";
import path from "path";
import crypto from "crypto";

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, `./public/temp`)
    },
    filename: function(req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = crypto.randomBytes(10).toString("hex");
        cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    }
})

export const upload = multer({
    storage
})