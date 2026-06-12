import multer from "multer";
import cryto from "crypto"

const storage = multer.diskStorage({
    destination: function(req,file, cb) {
        cb(null,`./public/temp`)
    },
    filename: function(req, file, ch) {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = crypto.randomBytes(10).toString(`hex`);
        cb(null, name + ext);
    }
})

export const upload = multer({
    storage
})