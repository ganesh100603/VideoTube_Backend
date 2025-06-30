import {Router} from "express"
import { getAllLikedVideos, toggleCommentLike, toggleTweettLike, toggleVideoLike } from "../controllers/like.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.use(verifyJWT)

router.route("/toggle/v/:videoId").post(toggleVideoLike)
router.route("/toggle/c/:commentId").post(toggleCommentLike)
router.route("/toggle/t/:tweetId").post(toggleTweettLike)
router.route("/videos").get(getAllLikedVideos)

export default router