# One fix: social-clip-cover still has a hard edge

Edit library.html only. Do not commit. Do not launch Chromium.

On the host render of social-clip-cover (1080 x 1920), the jukebox photo ends in a sharp horizontal line at about y 1080, then flat ink. The floor says there is never a hard edge between photo and ink.

Fix it the way the feed template does: the photo layer extends well below the headline area, and the burn gradient runs from ink 0% at about y 760 to ink 100% at about y 1240, over the photo itself, so the photo dissolves into the ink. No clip or hard stop on the photo layer. The headline and V4 then sit on fully burnt ink. Check that every other template sharing the same helper still renders as before.
