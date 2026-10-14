# Short-form video lengths, Reels cut-offs and safe zones

Researched 2026-10-14. Labels: PRIMARY = the platform's own page. SECONDARY = press or a third-party guide. UNCERTAIN = sources disagree, or the platform's page could not be read.

Note on the engine: `scripts/post-pack/publish_kit.py:58` already sets `VERTICAL_MAX_SECONDS = 90`, which is house rule TWO_CUTS. Krish's short cuts run 87 to 99 s, so some of them already break the engine's own rule.

---

## 1. Length limits by platform

### Instagram Reels
- **Upload and record limit is 20 min. Reels over 3 min are not shown to new audiences.** PRIMARY.
  - Sources: https://www.facebook.com/help/instagram/2720958398006062 ("Record a reel", the Instagram Help Centre article served through facebook.com) and https://about.instagram.com/features/reels. Both read 2026-10-14. Neither page shows a date.
  - Quotes: "You can record and edit videos up to 20 minutes with Instagram Reels." "You can record one or multiple clips that add up to 20 minutes." "Note: Reels over 3 minutes won't be recommended to new audiences."
- **The 90 s to 3 min change.** PRIMARY. Source: https://creators.instagram.com/blog/the-latest-with-instagram, dated 2025-01-21.
  - Quote: "Starting today, we're letting creators in the United States publish reels up to 3 minutes long in the Reels editor." The same post says reels up to 3 min are now "eligible to be seen by non-followers in places like the Reels tab and Explore". Before this, only reels of 90 s or less could be recommended.
- **Accepted aspect ratios.** PRIMARY. Source: https://www.facebook.com/help/instagram/1038071743007909, read 2026-10-14.
  - Quote: "You can upload a reel with an aspect ratio between 1.91:1 and 9:16."
- **Boosting a reel shared to Facebook: 60 s.** PRIMARY. Source: https://www.facebook.com/help/instagram/5557385897683570, read 2026-10-14.
  - Quote: "Your reel can be up to 60 seconds and should be in the fullscreen, vertical format."
- **Rollout is uneven.** UNCERTAIN. Many 2026 guides say some accounts still see a 90 s or 3 min cap in the composer. That depends on app version, region and account type. Example: https://www.tryordinal.com/blog/how-long-can-an-instagram-reel-be (2026). Meta has published nothing that confirms this.
- **Music cap of 90 s.** SECONDARY and UNCERTAIN. Guides quote an in-app message: "The same song can only be used for up to 90 seconds." Source: https://www.codepaint.app/post/instagram-reels-max-length-tips (2024). I found no Meta page that confirms it.
- **Edits app: 10 min cap.** SECONDARY. Launch coverage says videos "are capped at 10 minutes in length". Source: https://www.socialmediatoday.com/news/instagram-announces-launch-edits-video-editing-app/ (2025). This does not affect clips of about 90 s.

### Facebook (including Reels cross-posted from Instagram)
- **Meta says there is no length limit.** PRIMARY. Source: https://about.fb.com/news/2025/06/making-it-easier-create-videos-facebook/, dated 2025-06-17 and updated 2025-07-14.
  - Quote: "Reels on Facebook will also not have any length or format restrictions." Also: "we're also renaming the Video tab to Reels tab."
- **The old 90 s Facebook Reels cap is still quoted.** UNCERTAIN. Some 2026 guides still give it, for example https://learn.headliner.app/hc/en-us/articles/34164986965271-Social-Media-Video-Length-Limits-2026. In 2023 TechCrunch reported Meta saying that longer cross-posted Reels "will be supported" (https://techcrunch.com/?p=2329033). A 2025 Adobe community thread reports that Facebook does not treat videos over 90 s as Reels when they come from a third-party tool.
- **No cross-posting from a computer.** PRIMARY. Source: https://www.facebook.com/help/instagram/459497729122868 ("Share Instagram reels to Facebook"), read 2026-10-14.
  - Quote: "This feature isn't available on computers, but it is available on these devices."
- **Troubleshooting page has no length rule.** PRIMARY. Source: https://www.facebook.com/help/instagram/1206864193634431, read 2026-10-14. It lists only app updates, Accounts Center links and the sharing toggle.

### YouTube Shorts
- **3 min in the app and by upload.** PRIMARY. Source: https://support.google.com/youtube/answer/15424877, read 2026-10-14. This covers standard channels for uploads from 2024-10-15.
  - Quote: "You can now create YouTube Shorts up to three minutes in length." A video counts as a Short when it has "a square or vertical aspect ratio up to three minutes in length."
- **Copyright risk over 60 s.** PRIMARY, same page. A Short longer than one minute that has "an active copyright claim of any type" is blocked worldwide. It cannot be played, recommended or monetised. Shorts under one minute are not affected.
  - This is the biggest risk for our music bed. If the licensed track is registered in Content ID, a 61 to 99 s Short can be blocked.
- **Ads only: the Shorts feed plays the first 60 s.** PRIMARY. Source: https://support.google.com/google-ads/answer/16041697, read 2026-10-14.
  - Quote: "Video ads can be up to 3 minutes long, though only the first 60 seconds will play on the Shorts feed". This applies to paid ads, not to normal Shorts.

### TikTok
- **10 min recorded in the app, 60 min by upload.** SECONDARY and UNCERTAIN. TikTok's help pages are rendered in the browser and could not be read here.
  - Source: https://sociality.io/blog/tiktok-video-length/, updated 2026-03-03. Quotes: "Recorded in the TikTok app: up to 10 minutes." "Uploaded to TikTok: up to 60 minutes."
  - Background: TechCrunch, 2024-05-16 (https://techcrunch.com/2024/05/16/tiktok-upload-60-minute-videos): "TikTok is testing the ability for users to upload 60-minute videos". At that point the feature was "available to a limited group of users in select markets."
- **Rewards push videos over 1 min.** SECONDARY. Since March 2024 the Creator Rewards Program pays only for videos over one minute. Source: https://www.engadget.com/tiktok-to-creators-make-longer-videos-get-paid-055013923.html (2024-03). TikTok gives no official length for best reach. Guides suggest 60 to 180 s for explainers (sociality.io, same URL as above).
- **Ads.** PRIMARY. Source: https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads, read 2026-10-14. Non-Spark in-feed ads run "up to 10 minutes". Spark Ads have "No restrictions".

### X (Twitter)
- **Free accounts: 140 s. Premium: up to 4 h.** PRIMARY, read from a search-engine extract only. https://help.x.com/en/using-x/premium-longer-videos and https://help.x.com/en/using-x/x-videos returned HTTP 403 (a Cloudflare challenge) on 2026-10-14.
  - Extracted text: "If you aren't subscribed to X Premium ... you can still upload videos up to 140 seconds long with a maximum file size of 512MB."
  - Search summaries of the longer-videos page say Premium allows "up to 4 hours long (1080p)" on web and iOS, and 10 min on Android. Older copies of the page say 2 h or 3 h. UNCERTAIN.
- **API limits are different.** PRIMARY. Source: https://docs.x.com/x-api/media/introduction, read 2026-10-14. The API allows longer posts than the app.
  - Quotes: "Default (no Premium) | tweet_video, amplify_video | 20 minutes | 8 GB" and "Default (no Premium) | dm_video | 140 seconds (2 min 20 sec) | 512 MB".
  - This only matters if the engine ever posts through the API. For the app and web, use 140 s.

### LinkedIn
- **15 min.** PRIMARY. Source: https://www.linkedin.com/help/linkedin/answer/a548372, read 2026-10-14. The page says "Last updated: 2 years ago".
  - Quotes: "Maximum video duration: 15 minutes". "Maximum file size: 5 GB". "Aspect ratio: 1:2.4 - 2.4:1".
- **Mobile limit of 10 min.** SECONDARY and UNCERTAIN. Some guides say the mobile app caps at 10 min. LinkedIn's page does not say so.

---

## 2. "My reels are getting cut off": causes, how to tell, how to prevent

His cuts are 87 to 99 s, 1080x1920, H.264, about 29 MiB. The file itself is fine on every platform, since Reels accepts up to 9:16 and 4 GB. Here are the plausible causes, most likely first.

1. **The frame is cropped in the home feed (4:5).** SECONDARY: https://invideo.io/blog/instagram-reel-size-guide/ and https://growthscribe.com/instagram-reel-dimensions/ (2026). Meta's spec page does not mention it.
   - What happens: in the main feed, a 9:16 reel is shown cropped to about 1080x1350, centred. That cuts about 285 px from the top and the bottom. The Reels tab shows the full frame.
   - How to tell: the reel looks whole when opened in the Reels tab, but the top and bottom text is missing when it is scrolled past in the home feed.
   - Prevention: keep all text and the face inside y 285 to 1635. The safe zone below already does this.
2. **The profile grid crops the thumbnail (3:4).** SECONDARY.
   - Press confirms Instagram replaced the square grid with a rectangular one in January 2025. Engadget, 2025-01-18 (https://www.engadget.com/social-media/instagram-swoops-in-with-3-minute-reels-and-rectangular-profile-grids-as-the-tiktok-ban-gets-real-201316339.html): "changing the longstanding square grid on your profile to a rectangular layout."
   - The 3:4 ratio (1080x1440, centred, so about 240 px off the top and the bottom) comes from guides only. UNCERTAIN.
   - How to tell: the problem shows only on the profile page and the cover tile.
   - Prevention: centre the cover's title within the middle 1440 px. Optionally use the "adjust profile preview" crop when posting.
3. **Instagram's on-screen controls cover the text.** SECONDARY. These are not cropping, but they look like it.
   - What covers what: the bottom about 35% holds the caption, the audio line and the username. The right edge holds the like, comment and share buttons. The top holds the "Reels" title and the camera icon.
   - How to tell: the text is in the file but hidden under buttons or the caption on a phone. The caption grows when someone taps "more".
   - Prevention: use the safe zone in section 3.
4. **Length cap: trimmed to 90 s.** This would apply to the 91 to 99 s cuts only.
   - Possible reasons: the account or app version still has the older 90 s composer (UNCERTAIN), or one in-app music track is limited to 90 s (SECONDARY). Officially Reels allow 20 min (PRIMARY, above).
   - How to tell: the posted reel ends at exactly 90.0 s, and the 87 to 89 s cuts are never affected.
   - Prevention: cap the short cut at 89 s. That is what TWO_CUTS already requires. Burn the music bed into the file instead of adding Instagram audio, and update the app.
5. **The Facebook copy is cut, missing or a still image.** UNCERTAIN.
   - Meta says Facebook Reels have no length limit (PRIMARY, 2025-06-17). Users and third-party tools still report that versions over 90 s fail to share, or arrive as a cover image only (SECONDARY).
   - How to tell: the Instagram reel is whole, but the Facebook copy is short, missing or a still.
   - Prevention: stay at 89 s or less, and post to Facebook from the phone app (cross-posting "isn't available on computers", PRIMARY). If the copy fails, upload the file to Facebook natively.
6. **A Story share or a boost.** PRIMARY for the boost.
   - Boosting a reel shared to Facebook is limited to 60 s (help page 5557385897683570). Stories play about 60 s per card (SECONDARY). So a reel shared to a Story or boosted may look cut.
   - How to tell: only the Story or ad version is short.
   - Prevention: do not boost the 90 s cut. Make a separate 59 s or shorter ad edit if he wants paid reach.
7. **Desktop upload.** UNCERTAIN.
   - Uploading from instagram.com on a desktop can offer a crop choice. If "Original" is not selected, the frame may be cropped to 1:1 or 4:5. Desktop also cannot share the reel to Facebook (PRIMARY, quoted in 5 above).
   - How to tell: the frame is cropped in every view, not only in the feed, and the post was made from a computer.
   - Prevention: upload from the phone. On desktop, choose the original 9:16 crop.
8. **Shorts cross-post blocked or cut.** This is not Instagram, but it is related.
   - If the music bed gets a Content ID claim, a Short over 60 s is blocked entirely (PRIMARY).
   - How to tell: YouTube Studio shows a copyright claim and the Short is "blocked".
   - Prevention: confirm the music licence is cleared for YouTube Content ID or whitelisted on the channel. Otherwise keep Shorts at 59 s or less.

Quick check for Krish: send the next posted reel's link and its length on the platform.
- Ends at 90.0 s: cause 4.
- Text lost only in the home feed: cause 1.
- Only on the profile: cause 2.
- Hidden under buttons: cause 3.
- Only the Facebook or Story copy: cause 5 or 6.

---

## 3. Recommendation

### One duration: hard cap 89 s, target 75 to 85 s
- **Inside every platform's free limit:**
  - Reels: under the 3 min line for being recommended to non-followers, and under every older 90 s composer and music cap.
  - Facebook: under the old 90 s cross-post limit that some tools still apply.
  - Shorts: under the 3 min limit.
  - TikTok: under the 10 min in-app limit.
  - X free accounts: under 140 s.
  - LinkedIn: under 15 min.
- **It matches the engine.** It agrees with `VERTICAL_MAX_SECONDS = 90` and TWO_CUTS. The 1 s margin under 90 covers encoder padding and the outro, so a file is never 90.03 s.
- **Two exceptions need 59 s or less.**
  - YouTube Shorts with music that might get a Content ID claim (a claimed Short over 60 s is blocked).
  - Any paid boost of a reel shared to Facebook (60 s cap).
  - If either applies, add a 59 s variant. Do not shorten the main cut.
- **Action:** the engine should refuse any short-cut render over 89.0 s, measured from the final file with ffprobe, not from the script word count. Right now cuts of up to 99 s are getting through.

### Safe zone for text at 1080x1920
This is the union of the Reels, Shorts and TikTok overlays, plus the Instagram 4:5 feed crop and the 3:4 grid crop.

| Margin | px | Driven by |
|---|---|---|
| Top | 290 | Shorts ads 288 (Google, via socialync.io); Reels about 269 (14%); 4:5 feed crop about 285 |
| Bottom | 680 | Shorts ads 672 and Reels 672 (35%); TikTok 484 to 660 depending on caption length |
| Right | 200 | Shorts 192; TikTok 140; Reels about 65 to 120 |
| Left | 70 | Reels 65 (6%); Shorts 48; TikTok 44 |

- This leaves a text box from x 70 to 880 and y 290 to 1240, which is 810x950 px.
- Put burned-in captions near the bottom of that box, at y 1080 to 1240, not in the usual lower third at y 1500 or more.
- Keep the face and the hook text centred on x of about 475 to 540, and y of 600 to 1100.

Where each figure comes from. All are SECONDARY, and none could be checked against a platform page.
- **Reels: 14% top, 35% bottom, 6% sides.** Guides attribute this to Meta's Ads Manager safe-zone guardrail, for example https://www.biddyco.com/blog-posts/meta-ad-specs (2026). Meta's organic Reels spec page gives no safe zone.
- **TikTok: 130 top, 484 bottom, 140 right, 44 left.** Widely repeated in guides such as https://cadenus.io/resources/blog/tiktok-safe-zone/ (2026). Another guide gives 240/660/120. TikTok's own ads help page (PRIMARY) gives no pixel values. It only says the safe zone "is determined by the dimension" and that a longer caption shrinks it.
- **Shorts: 288 top, 672 bottom, 48 left, 192 right.** Attributed to Google's vertical ad template by https://www.socialync.io/tools/safe-zones/youtube-shorts. Google's help page (PRIMARY, https://support.google.com/google-ads/answer/9128498) shows a "red safe area" image but no numbers in its text.

If the lighter organic overlays turn out to be enough after checking on a phone, the bottom margin could relax to about 500 px. Start with 680 and loosen it only after a phone check on all three apps.
