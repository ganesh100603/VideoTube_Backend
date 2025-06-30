import { Router } from "express";
import { addVideoToPlaylist, 
        createPlaylist, 
        deletePlaylist, 
        getPlaylistById, 
        getUserPlaylist, 
        removeVideoPlaylist, 
        updatePlaylist } from "../controllers/playlist.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js"; 
const router = Router()

router.use(verifyJWT,upload.none())

router.route("/").post(createPlaylist)

router
.route("/:playlistId")
.get(getPlaylistById)
.patch(updatePlaylist)
.delete(deletePlaylist)

router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist)
router.route("/remove/:videoId/:playlistId").patch(removeVideoPlaylist)
router.route("/user/:userId").get(getUserPlaylist)

export default router