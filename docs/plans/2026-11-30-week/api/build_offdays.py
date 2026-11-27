"""Builds the off-day options of docs/plans/2026-11-30-week/ideas.json (the Sunday ideas run, 26 Nov 2026)."""
import json

LF_LAME = '"The idea is lame. This doesn\'t translate into a carousel properly." (your Reject, 9 Nov, of the 16 Nov board\'s burn-tokens carousel)'
LF_BORING = '"It\'s kind of boring and I also don\'t really understand the point of it or what the takeaway is." (your Reject, 3 Nov, of the 9 Nov board\'s quote-line post)'
LF_REAL = '"I want actual news items and the content we are going to use here - embedded real world images or videos" (your Improve, 2 Nov, of the good news)'
LF_SUBSTANCE = '"Let\'s align this for when the full piece has more substance behind it." (your File for later, 9 Nov, of the 16 Nov board\'s swarm-deal post)'
LF_SHOW = '"I think we\'ll need to wait until this piece is more substantiated." (your File for later, 9 Nov, of the 16 Nov board\'s tiny-fix post)'


def card(words, picture):
    return {'words': words, 'picture': picture}


def carousel(opt, flow_cards, look, inspo):
    opt['cards'] = [card(w, p) for w, p in flow_cards]
    opt['direction'] = {
        'look': look, 'format': f'{len(flow_cards)} cards, 4:5',
        'frames': [card(w, p) for w, p in flow_cards],
        'tone': 'Plain, warm, a little dry; the joke is in the headline and the facts.',
        'kit': 'The v5 Library carousel set, the house palette and type from config/brand-palette.json',
        'inspo_url': inspo,
    }
    return opt


tue = [
    carousel({
        'id': 'photonstems', 'kind': 'explainer', 'format': 'Explainer carousel, 5 cards, 4:5', 'source_tag': 'trade_press',
        'source': {'label': 'Newsshooter, iZotope Photon: GPU-powered audio processing software (5 Nov 2026)', 'url': 'https://www.newsshooter.com/2026/11/05/izotope-photon-gpu-powered-audio-processing-software/'},
        'copy': 'iZotope Photon pulls a finished song apart into its parts, and up to six voices out of one recording, on your own computer. It costs $259 until 7 December, against $349 after.',
        'hook': 'Take any song apart on your own laptop. $259 until 7 December.',
        'pitch': {'see': 'A finished track splitting into vocals, drums, bass and the rest, card by card.', 'lands': 'It is a job studios used to pay an engineer for, now a plug-in with a sale price and a date.', 'why_now': 'Launched in early November 2026; introductory price runs to 7 December.', 'share': 'The stem tool that runs on your own machine, and what it costs this week.'},
        'shape': 'story', 'dive': 'Photon runs 12 separation and clean-up models locally on the computer\'s graphics chip, inside the editor or on its own.',
        'aim': 'utility', 'funny': 'Your laptop can now un-bake a cake, if the cake is a song.',
        'lookalike': {'pattern': 'tool-unlock', 'beats': 'https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/', 'our_take': 'The post listed a deal; we list what the tool does for a producer and when the price goes up.'},
        'learned_from': [LF_LAME], 'recommended': True,
    }, [
        ('Take any song apart on your own laptop.', 'A mixing desk with one fader lit for each part: voice, drums, bass, other'),
        ('Four parts out of one song, and drums one by one.', 'A waveform split into four coloured lanes'),
        ('$259 until 7 December. $349 after.', 'A price tag with the date on it'),
        ('It runs on your computer. Try it on your own track first.', 'A laptop with the graphics chip glowing'),
        ('Open it inside Pro Tools, Cubase or REAPER, or on its own.', 'The plug-in window over a session'),
    ], 'Tool card, after the Higgsfield offer post in your sheet', 'https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/'),
    carousel({
        'id': 'splicecreate', 'kind': 'explainer', 'format': 'Explainer carousel, 5 cards, 4:5', 'source_tag': 'trade_press',
        'source': {'label': 'The Fader, Splice launches its own DAW, Splice Create (6 Nov 2026)', 'url': 'https://www.thefader.com/2026/11/06/splice-launches-its-own-daw-splice-create'},
        'copy': 'Splice Create is a free Mac music app with more than three million licensed sounds built in and an assistant you can talk to. Making is free; exporting and licensing need the $9.99-a-month plan.',
        'hook': 'A free music studio with 3 million sounds. The catch is the export button.',
        'pitch': {'see': 'A beat being built from the sample library by voice, then the export button with a padlock.', 'lands': 'It is useful straight away, and the catch is one honest line.', 'why_now': 'Beta launched 5 November 2026.', 'share': 'Free to make, $9.99 to take it home.'},
        'shape': 'story', 'dive': 'Its assistant, Rheo, searches the library, writes MIDI and arranges by voice or text, and Splice says it does not generate new sounds.',
        'aim': 'utility', 'funny': 'The studio is free, the door out costs $9.99 a month.',
        'lookalike': {'pattern': 'tool-unlock', 'beats': 'https://www.instagram.com/evolving.ai/p/DfxJW8mAElc/', 'our_take': 'The post sold prompts; we say what is free, what is paid and what the assistant will not do.'},
        'learned_from': [LF_LAME],
    }, [
        ('A free music studio with 3 million sounds.', 'A studio door with a welcome mat'),
        ('Talk to it: "give me a drum loop at 90".', 'A speech bubble turning into a drum grid'),
        ('It finds and arranges sounds. It does not make new ones.', 'A library shelf of sample boxes'),
        ('Free to make. $9.99 a month to export.', 'The export button with a padlock'),
        ('Mac only for now, in beta.', 'A laptop with a beta sticker'),
    ], 'Tool card, after the floor-plan prompts post in your sheet', 'https://www.instagram.com/evolving.ai/p/DfxJW8mAElc/'),
    carousel({
        'id': 'djvoices', 'kind': 'explainer', 'format': 'Explainer carousel, 5 cards, 4:5', 'source_tag': 'trade_press',
        'source': {'label': 'TechCrunch, Spotify\'s AI DJ gets new voices, personalities and an option for less chatter (10 Nov 2026)', 'url': 'https://techcrunch.com/2026/11/10/spotifys-ai-dj-gets-new-voices-personalities-and-an-option-for-less-chatter/'},
        'copy': 'Spotify\'s AI DJ now has nine new voices and a setting that cuts most of the talking between songs. For an artist, that means the DJ that introduces your track can now talk less and play more.',
        'hook': 'Spotify\'s AI DJ can finally stop talking.',
        'pitch': {'see': 'A radio presenter\'s microphone with a mute switch, then nine name badges.', 'lands': 'Everyone has wanted the DJ to talk less, and now there is a switch.', 'why_now': 'Rolled out to Premium users from 10 November 2026.', 'share': 'Where the switch is: search DJ, then the three dots.'},
        'shape': 'story', 'dive': 'The DJ keeps choosing songs for you while the new setting removes most of the voice between them.',
        'aim': 'utility', 'funny': 'Spotify gave its DJ nine new voices and a button to use none of them.',
        'lookalike': {'pattern': 'tool-unlock', 'beats': 'https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/', 'our_take': 'The post listed an offer; we show where the switch is and what it means for the songs it plays.'},
        'learned_from': [LF_BORING],
    }, [
        ('Spotify\'s AI DJ can finally stop talking.', 'A microphone with a mute switch'),
        ('Nine new voices, from British to Indian English.', 'Nine name badges on a desk'),
        ('A new setting cuts most of the chat between songs.', 'A speech bubble shrinking to a dot'),
        ('Find it: search DJ, tap the three dots.', 'The DJ card with the menu open'),
        ('Less talk, more of the songs it picks for you.', 'A playlist rolling on'),
    ], 'Tool card, after the Higgsfield offer post in your sheet', 'https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/'),
    carousel({
        'id': 'freeanimation', 'kind': 'explainer', 'format': 'Explainer carousel, 5 cards, 4:5', 'source_tag': 'instagram',
        'source': {'label': 'syntaix.ai on Instagram, ten open-source animation, motion and VFX tools (4 Nov 2026)', 'url': 'https://www.instagram.com/syntaix.ai/p/DfUpCCLiSfS/'},
        'copy': 'Free, open-source tools now cover most of an animation studio: 2D animation, motion graphics, motion capture from a webcam and visual effects. We pick the four an animator can use this week and say what each replaces.',
        'hook': 'An animation studio for $0: four free tools that do the expensive jobs.',
        'pitch': {'see': 'A studio desk where each expensive box is swapped for a free one.', 'lands': 'It saves an animator money the same day.', 'why_now': 'Found in your Instagram inspo sheet, 4 Nov 2026.', 'share': 'Four free tools, and the paid one each replaces.'},
        'shape': 'story', 'dive': 'Each tool is open source, so it is free to use, and each covers one paid job: 2D animation, motion capture, compositing, particle effects.',
        'aim': 'utility', 'funny': 'The most expensive thing in this animation studio is the coffee.',
        'lookalike': {'pattern': 'tool-unlock', 'beats': 'https://www.instagram.com/evolving.ai/p/DfxJW8mAElc/', 'our_take': 'The post listed ten repositories; we pick four, say what each replaces and who it suits.'},
        'learned_from': [LF_LAME],
    }, [
        ('An animation studio for $0.', 'A studio desk with price tags crossed out'),
        ('OpenToonz: full 2D animated productions.', 'A hand-drawn character mid-walk'),
        ('FreeMoCap: capture real movement in 3D.', 'A person moving, traced by dots'),
        ('Natron: professional visual effects.', 'A shot with smoke composited in'),
        ('Effekseer: fire, explosions and sparks.', 'A spark burst on a dark frame'),
    ], 'Tool card, after the floor-plan prompts post in your sheet', 'https://www.instagram.com/evolving.ai/p/DfxJW8mAElc/'),
    {
        'id': 'grimesdeepseek', 'kind': 'voiceover', 'format': 'Voiceover short with motion graphics, 9:16, about 60 seconds', 'style': 'voiceover', 'source_tag': 'trade_press',
        'source': {'label': 'Stereogum, Grimes teases new album Psy Opera, says she doesn\'t use generative AI in her music', 'url': 'https://www.stereogum.com/2496372/grimes-teases-new-album-psy-opera-claims-she-doesnt-use-generative-ai-in-her-music/news'},
        'copy': 'Grimes made an album about AI and says she used no generative AI on it, apart from one song, "DeepSeek", whose lyrics were partly written by DeepSeek. It is the most honest AI credit in music this year.',
        'hook': 'Grimes made an album about AI with no AI in it. Except one song.',
        'pitch': {'see': 'A record sleeve with a credits list, one line glowing.', 'lands': 'The joke writes itself: the only AI on the AI album is in the song named after an AI.', 'why_now': 'Psy Opera songs released through autumn 2026.', 'share': 'The only AI on the AI album is in the song called DeepSeek.'},
        'shape': 'story', 'dive': 'She drew a line between using AI as a subject and as a tool, and credited the one place she crossed it.',
        'aim': 'humour', 'funny': 'The only AI on the AI album is in the song named after the AI.',
        'lookalike': {'pattern': 'creator-hands-over', 'beats': 'https://www.instagram.com/evolving.ai/p/Dc_4Sy7gGi5/', 'our_take': 'The post was a creator handing everything to AI; this is a creator handing it exactly one song and saying so.'},
        'learned_from': [LF_BORING],
    },
]

thu = [
    carousel({
        'id': 'elevensoundcloud', 'kind': 'explainer', 'format': 'Explainer carousel, 5 cards, 4:5', 'source_tag': 'trade_press',
        'source': {'label': 'The Next Web, SoundCloud lets ElevenMusic users publish AI-made songs directly (Nov 2026)', 'url': 'https://thenextweb.com/news/soundcloud-elevenmusic-ai-songs-direct-publishing'},
        'copy': 'ElevenMusic songs can now go straight to SoundCloud from the app, and SoundCloud Artist Pro members get three months of ElevenMusic Pro free. After that it is $9.99 a month, so check the renewal before you claim it.',
        'hook': 'Make a song in one app, post it in another, in one tap. Three months free.',
        'pitch': {'see': 'A song flying from one phone app straight onto a SoundCloud page.', 'lands': 'Useful for any artist on SoundCloud, with the catch said plainly.', 'why_now': 'Announced 5 to 6 November 2026.', 'share': 'Three months of ElevenMusic Pro free for SoundCloud Artist Pro members.'},
        'shape': 'story', 'dive': 'The integration skips the download and upload: a track made in ElevenMusic is published to SoundCloud from inside the app.',
        'aim': 'utility', 'funny': 'The song now arrives on SoundCloud before you have decided whether it is any good.',
        'lookalike': {'pattern': 'tool-unlock', 'beats': 'https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/', 'our_take': 'The post listed a free trial; we say who gets it, what it does and when it starts to cost.'},
        'learned_from': [LF_LAME], 'recommended': True,
    }, [
        ('Make it in one app, post it in another, in one tap.', 'A song arrow from one phone to another'),
        ('ElevenMusic now publishes straight to SoundCloud.', 'The SoundCloud page filling in'),
        ('Artist Pro members: three months of Pro free.', 'A gift tag with "3 months"'),
        ('Pro: up to 1,000 songs and 500 stem splits a month.', 'A counter ticking'),
        ('After that, $9.99 a month. Check the renewal first.', 'A calendar with one date circled'),
    ], 'Tool card, after the Higgsfield offer post in your sheet', 'https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/'),
    carousel({
        'id': 'videoplugin', 'kind': 'explainer', 'format': 'Explainer carousel, 6 cards, 4:5', 'source_tag': 'his_card',
        'source': {'label': 'evolving.ai on Instagram, Higgsfield inside ChatGPT and Claude (Nov 2026)', 'url': 'https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/'},
        'covers': ['dde4b46f-fa8b-4ba4-b0e8-b82b5d5352d3'],
        'asks': [{'id': 'dde4b46f-fa8b-4ba4-b0e8-b82b5d5352d3', 'said': 'We could do a carousel explaining what an MCP connector is in this kind of way, where all the different connectors are actually different people sitting around a board table. Then in the next shot they\'re sending a pigeon carrier to one another. In another one', 'scope': 'narrowed', 'why': 'Told through one connector a video maker can use this week, Higgsfield inside ChatGPT and Claude, so the board table has a real guest.'}],
        'copy': 'A connector lets your chatbot call another app for you, like a guest at the table who does one job. Higgsfield\'s video tools now plug into ChatGPT and Claude this way: here is what that means and how to add it.',
        'hook': 'Your chatbot just invited a video studio to the table.',
        'pitch': {'see': 'A board table of apps as people, one passing a note by pigeon to the video studio.', 'lands': 'It explains connectors the way you asked, with a tool a video maker can use today.', 'why_now': 'Higgsfield\'s plugin for ChatGPT and Claude, November 2026.', 'share': 'What a connector is, in one picture: a guest who does one job.'},
        'shape': 'story', 'dive': 'A connector (MCP) lets the chatbot send a request to another app and bring its answer back, so the video is made by Higgsfield from inside the chat.',
        'aim': 'utility', 'funny': 'The chatbot does not make videos; it just knows a guy.',
        'learned_from': [LF_LAME],
    }, [
        ('Your chatbot just invited a video studio to the table.', 'A board table of apps drawn as people, one empty chair'),
        ('A connector is a guest who does one job.', 'The video studio takes the chair'),
        ('You ask the chatbot. It passes a note.', 'A pigeon carrying a note across the table'),
        ('The guest makes the video and passes it back.', 'The pigeon returning with a film reel'),
        ('Add it: Plugins, Connect plugins, search Higgsfield.', 'The plugin menu with the search box'),
        ('Check the price on the day before you rely on it.', 'A price tag face down on the table'),
    ], 'Explainer, the board-table picture from your saved card', 'https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/'),
    {
        'id': 'disneyfoundry', 'kind': 'voiceover', 'format': 'Voiceover short with motion graphics, 9:16, about 60 seconds', 'style': 'voiceover', 'source_tag': 'trade_press',
        'source': {'label': 'GamesBeat, Adobe and Disney announce multi-year AI alliance, with custom Firefly Foundry models (Nov 2026)', 'url': 'https://gamesbeat.com/?p=338587'},
        'copy': 'Disney and Adobe signed a multi-year alliance for custom Firefly Foundry models built on Disney\'s own characters and styles. It is a studio buying an AI that only knows its own world.',
        'hook': 'Disney is getting an AI that only knows Disney.',
        'pitch': {'see': 'A sketchbook of familiar silhouettes feeding a machine with a castle on it.', 'lands': 'It is the opposite of an AI that learned from everyone: a private one that learned from one studio.', 'why_now': 'Announced 9 November 2026.', 'share': 'The studio that bought an AI which has only ever seen its own films.'},
        'shape': 'story', 'dive': 'Firefly Foundry builds a custom model on a company\'s own assets on top of Adobe\'s licensed base models, and keeps it private to that company.',
        'aim': 'interest', 'funny': 'Disney finally found an AI that has never heard of any other studio.',
        'lookalike': {'pattern': 'money-twist', 'beats': 'https://www.instagram.com/evolving.ai/p/DfsIpdXgBA1/', 'our_take': 'The post showed money moving between AI firms; we show a studio paying for an AI that stays home.'},
        'learned_from': [LF_SUBSTANCE],
    },
    carousel({
        'id': 'klingthirty', 'kind': 'explainer', 'format': 'Explainer carousel, 5 cards, 4:5', 'source_tag': 'trade_press',
        'source': {'label': 'Bernama, Kuaishou launches Kling 4.0 (15 Oct 2026)', 'url': 'https://www.bernama.com/tv/news.php?id=2622573'},
        'copy': 'Kling 4.0 makes single AI video clips up to 30 seconds long from up to 15 of your own reference images or clips. For a small team, that is a storyboard you can watch.',
        'hook': 'Thirty seconds of film from 15 of your own pictures.',
        'pitch': {'see': 'Fifteen photos on a corkboard becoming one moving shot.', 'lands': 'It is a real step for anyone making videos on a small budget.', 'why_now': 'Kling 4.0 launched 15 October 2026 and is now open to all users.', 'share': 'Pin 15 pictures, get 30 seconds of film.'},
        'shape': 'story', 'dive': 'The model takes up to 15 reference inputs, so the characters and places in the clip are yours, and holds them for up to 30 seconds.',
        'aim': 'utility', 'funny': 'Your mood board now moves, and occasionally gives a character a sixth finger.',
        'lookalike': {'pattern': 'made-in-hours', 'beats': 'https://www.instagram.com/evolving.ai/p/DfuWseGgGfl/', 'our_take': 'The post showed what others made; we show how to feed it your own pictures.'},
        'learned_from': [LF_REAL],
    }, [
        ('Thirty seconds of film from 15 of your pictures.', 'A corkboard of 15 photos'),
        ('Up to 15 references: faces, places, props.', 'Three photos lifting off the board'),
        ('One clip, up to 30 seconds long.', 'A film strip running 0 to 30'),
        ('Use it for a storyboard you can watch.', 'A director watching a rough cut'),
        ('Check each frame before it goes out.', 'A magnifying glass on one frame'),
    ], 'Tool card, after the made-in-hours post in your sheet', 'https://www.instagram.com/evolving.ai/p/DfuWseGgGfl/'),
    carousel({
        'id': 'threecuts', 'kind': 'explainer', 'format': 'Explainer carousel, 5 cards, 4:5', 'source_tag': 'trade_press',
        'source': {'label': 'TechCrunch, YouTube adds new creator tools like video A/B testing, dynamic thumbnails and live dubbing (23 Sep 2026)', 'url': 'https://techcrunch.com/2026/09/23/youtube-adds-new-creator-tools-like-video-a-b-testing-dynamic-thumbnails-and-live-dubbing/'},
        'copy': 'YouTube lets creators test up to three different cuts of a video to see which opening holds viewers best, and an AI assistant gives feedback on drafts. Here is how a creator uses it on their next upload.',
        'hook': 'Upload three versions. YouTube tells you which opening worked.',
        'pitch': {'see': 'Three thumbnails racing, one pulling ahead.', 'lands': 'It turns guessing your hook into a test.', 'why_now': 'Announced at Made on YouTube, 23 September 2026.', 'share': 'Test three cuts, keep the one people watch.'},
        'shape': 'story', 'dive': 'The test shows different cuts to different viewers and reports which hook holds attention best.',
        'aim': 'utility', 'funny': 'You no longer have to argue with yourself about the opening; YouTube will do it with strangers.',
        'lookalike': {'pattern': 'tool-unlock', 'beats': 'https://www.instagram.com/evolving.ai/p/DfxJW8mAElc/', 'our_take': 'The post sold prompts; we show a test any creator can run on the next video.'},
        'learned_from': [LF_BORING],
    }, [
        ('Upload three versions. Keep the one people watch.', 'Three video frames side by side'),
        ('Each version opens a different way.', 'Three different first frames'),
        ('YouTube shows each to different viewers.', 'Viewers splitting into three groups'),
        ('It reports which hook held them longest.', 'A bar chart with one bar tallest'),
        ('Run it on your next upload.', 'An upload button'),
    ], 'Tool card, after the floor-plan prompts post in your sheet', 'https://www.instagram.com/evolving.ai/p/DfxJW8mAElc/'),
]


def template(id_, title, page, poster, seconds, found_place, found_label, credit, what, why, mech, captions, date, day, covers=None, said=None):
    t = {
        'id': id_, 'kind': 'meme', 'format': 'Meme template, your caption on the clip, 9:16 and 4:5',
        'source': {'label': found_label, 'url': page},
        'copy': f'{what} It becomes {why[0].lower() + why[1:]}',
        'hook': title, 'pitch': {'see': what, 'lands': why},
        'aim': 'humour', 'shape': 'story', 'funny': why,
        'template': {'title': title, 'clip': {'url': page, 'page': page, 'poster': poster, 'seconds': seconds},
                     'found': {'place': found_place, 'label': found_label, 'url': page}, 'credit': credit,
                     'what_happens': what, 'why_it_works': why, 'mechanism': mech, 'moment': None, 'date': date},
        'caption_ideas': captions,
    }
    if covers:
        t['covers'] = covers
    return t


templates_tue = [
    template('tplconfused', 'Will Ferrell: "I guess I\'m feeling a little confused"', 'https://www.tiktok.com/@viralgreenscreenhub/video/7706509569278741782', None, 8,
             'tiktok', 'TikTok, #memetemplate', '@viralgreenscreenhub on TikTok',
             'Will Ferrell looks around, lost, and says he is feeling a little confused.',
             'Understatement in the studio: the producer reading an AI mastering report that rates the demo higher than the single.',
             ['understatement', 'incongruity'],
             ['When the AI mastering tool rates your demo higher than the single', 'The label\'s AI says the song is 43% you', 'When the AI stem splitter finds a second drummer on your solo album'], '2026-11-10', 'tue'),
    template('tplnogod', 'Steve Carell: "No, God, please, no!"', 'https://www.tiktok.com/@viralgreenscreenhub/video/7708713323', None, 5,
             'tiktok', 'TikTok, #memetemplate', '@viralgreenscreenhub on TikTok',
             'Steve Carell, as Michael Scott, shouts "No, God, please, no!" at the sky.',
             'Exaggeration at the record label: the A&R team watching a streaming app delete 29 million songs, including their lo-fi playlist.',
             ['exaggeration', 'reversal'],
             ['The 400 AI lo-fi albums the day the streaming app started deleting', 'When the AI cover art gives the band a fifth member', 'Your AI video editor exporting the blooper reel as the final cut'], '2026-11-16', 'tue'),
    template('tplpushthrough', 'Jamie Lee Curtis: "I don\'t know what day it is, I\'m just trying to push through"', 'https://www.tiktok.com/@viralgreenscreenhub/video/7706516941', None, 6,
             'tiktok', 'TikTok, #memetemplate', '@viralgreenscreenhub on TikTok',
             'Jamie Lee Curtis, frazzled, says she does not know what day or time it is and is just trying to push through.',
             'Deadpan for the edit suite: the editor on day three of fixing the AI\'s hands in every frame of a music video.',
             ['understatement', 'irony'],
             ['Day three of fixing the hands in the AI music video', 'The animator when the AI made 200 frames and each needs redrawing', 'Tour week, and the AI setlist keeps adding songs we never wrote'], '2026-11-10', 'tue'),
    template('tplwoke', 'POV: the AI that needs to think without being disturbed', 'https://youtube.com/shorts/y7V-VXhHEhc?is=pp59I23mfTUuPqd7', None, None,
             'card', 'Your saved card, 17 Nov', 'The original poster on YouTube',
             'A character waves off anyone who comes near because they need to think, undisturbed.',
             'Personification in the studio: the AI collaborator that refuses to render the track until it has had its quiet time.',
             ['personification', 'absurd_reasoning'],
             ['POV: your AI co-writer in 2028 asking for a quiet room before the chorus', 'POV: the AI editor at 2am, needing space before it exports', 'POV: the AI session drummer wants to "sit with the groove" first'], '2026-11-17', 'tue',
             covers=['3d306bf9-3e6b-4c34-bc85-f63340036f5c']),
]

templates_thu = [
    template('tplchihuahua', 'The singing Chihuahua', 'https://www.tiktok.com/@greenscreenmemes.com/video/770736228', None, 7,
             'tiktok', 'TikTok, #memetemplate', '@greenscreenmemes.com on TikTok',
             'A Chihuahua throws its head back and sings, fully committed and slightly off key.',
             'Incongruity at the awards: the AI artist of the year giving its acceptance song.',
             ['incongruity', 'exaggeration'],
             ['The AI artist of the year performing live', 'Me pitching my AI-generated demo to the label', 'The AI voice clone the day after you skip the training data'], '2026-11-12', 'thu'),
    template('tplarnold', 'Arnold Schwarzenegger is watching', 'https://www.tiktok.com/@flurrist/video/7323979642249989381', None, 10,
             'tiktok', 'TikTok, #memetemplate', '@flurrist on TikTok',
             'Arnold Schwarzenegger stares, unblinking, nodding slowly to a dance track.',
             'Deadpan at the gig: the session musician watching the AI band play their part, note for note.',
             ['understatement', 'irony'],
             ['The session drummer watching the AI play his fill back to him', 'The VFX artist watching the AI do her shot in four seconds', 'The match commentator hearing his AI voice call the goal'], '2024-01-14', 'thu'),
    template('tpldumbest', 'Stephen A. Smith: "you might be one of the dumbest folks on the planet"', 'https://www.tiktok.com/@chiefgreenscreens/video/768221443104', None, 9,
             'tiktok', 'TikTok, #memetemplate', '@chiefgreenscreens on TikTok',
             'Stephen A. Smith turns slowly to camera and, affectionately, calls someone one of the dumbest folks on earth.',
             'Precise cruelty aimed at the hype: the sports pundit reacting to the club\'s AI-made matchday poster with the stadium in the wrong city.',
             ['sarcasm', 'reversal'],
             ['The club\'s AI matchday poster put our stadium in the wrong city', 'The AI said our striker is "a strong sixth-round pick"', 'The AI highlight reel only showed the other team scoring'], '2026-09-06', 'thu'),
]

tue += templates_tue
thu += templates_thu

GOODNEWS_FLOW = 'weekly-roundup'

sat_weekly = {
    'id': 'goodnews', 'weekly': 'good_news', 'kind': 'good_news', 'stories_due': '2026-11-26',
    'format': 'Good-news carousel, 6 cards, 4:5', 'source_tag': 'instagram',
    'topic': 'makers who reached millions with AI',
    'source': {'label': 'Your Instagram inspo sheet, with each story\'s own source', 'url': 'https://www.instagram.com/evolving.ai/reel/DfHwPJsgbeb/'},
    'copy': 'Four people in animation, film, games and video who made something with AI this month that millions of people chose to watch or play. Each one did the part only they could do.',
    'hook': 'This month AI helped four makers reach millions. Each one did the hard part.',
    'pitch': {'see': 'A gentleman with an umbrella helping strangers in New York, a painted Bible epic, a hand-built game world and a video site picked by real people.', 'lands': 'It is uplifting, real and in the reader\'s world, and each story credits the human.', 'why_now': 'All four from 30 October to 16 November 2026, found in your Instagram inspo sheet.', 'share': 'Four makers, four tools, millions of viewers.'},
    'shape': 'theme', 'aim': 'interest', 'funny': 'The AI did the frames; the human still had to decide the gentleman helps the pizza rat.',
    'lookalike': {'pattern': GOODNEWS_FLOW, 'beats': 'https://www.instagram.com/evolving.ai/p/Dc_GTNigPhb/', 'our_take': 'The post rounded up the week\'s launches; ours rounds up the people who made something with them.'},
    'learned_from': [LF_REAL],
    'stories': [
        {'headline': 'An animator\'s gentleman went viral helping New Yorkers', 'what': '"Englishman in New York" by @antrofrog follows an animated gentleman helping pedestrians, buskers and the pizza rat, made with Midjourney for the character and Seedance for the animation.', 'why': 'One maker reached millions with a hand-drawn look and a kind character.', 'kind': 'creators', 'helps': {'who': 'Independent animators', 'how': 'more successful'}, 'date': '2026-10-30', 'source': {'label': 'antrofrog on Instagram, Englishman in New York', 'url': 'https://www.instagram.com/evolving.ai/reel/DfHwPJsgbeb/'}, 'media': {'kind': 'clip', 'url': 'https://www.instagram.com/evolving.ai/reel/DfHwPJsgbeb/'}, 'found': {'label': 'Your Instagram inspo sheet', 'url': 'https://www.instagram.com/evolving.ai/reel/DfHwPJsgbeb/'}},
        {'headline': 'A filmmaker turned classical paintings into a Bible epic', 'what': '"The Biblical Experience" by @samyazaspeaks moves through the Bible\'s best-known moments using classical paintings, camera moves and music.', 'why': 'Centuries of religious art, brought to life by one filmmaker.', 'kind': 'film_tv', 'helps': {'who': 'Independent filmmakers', 'how': 'more successful'}, 'date': '2026-11-01', 'source': {'label': 'samyazaspeaks on Instagram, The Biblical Experience', 'url': 'https://www.instagram.com/evolving.ai/reel/DfMf7sYgHIt/'}, 'media': {'kind': 'clip', 'url': 'https://www.instagram.com/evolving.ai/reel/DfMf7sYgHIt/'}, 'found': {'label': 'Your Instagram inspo sheet', 'url': 'https://www.instagram.com/evolving.ai/reel/DfMf7sYgHIt/'}},
        {'headline': 'Players built games and painted worlds in an afternoon', 'what': 'People used a new Claude model to build playable games and 3D worlds in hours, including a game painted with about 1.5 million brush strokes a frame and a ride through Van Gogh\'s Starry Night.', 'why': 'Making a game now starts with an idea, not a team.', 'kind': 'games', 'helps': {'who': 'Hobby game makers', 'how': 'happier'}, 'date': '2026-11-16', 'source': {'label': 'evolving.ai on Instagram, games and worlds built with Claude Fable 5.2', 'url': 'https://www.instagram.com/evolving.ai/p/DfuWseGgGfl/'}, 'media': {'kind': 'photo', 'url': 'https://www.instagram.com/evolving.ai/p/DfuWseGgGfl/'}, 'found': {'label': 'Your Instagram inspo sheet', 'url': 'https://www.instagram.com/evolving.ai/p/DfuWseGgGfl/'}},
        {'headline': 'A video site picked by people, built in two hours', 'what': 'Andrej Karpathy built HackerTube, 6,454 videos chosen from 43 million Hacker News comments over 20 years, with an AI doing almost all of the build in about two hours.', 'why': 'Viewers get videos recommended by real people instead of an algorithm.', 'kind': 'media', 'helps': {'who': 'Viewers looking for videos people actually recommend', 'how': 'smarter'}, 'date': '2026-11-02', 'source': {'label': 'therundownai on Instagram, Karpathy\'s HackerTube (source: Andrej Karpathy on X)', 'url': 'https://www.instagram.com/therundownai/p/DfQCWHZEreu/'}, 'media': {'kind': 'photo', 'url': 'https://www.instagram.com/therundownai/p/DfQCWHZEreu/'}, 'found': {'label': 'Your Instagram inspo sheet', 'url': 'https://www.instagram.com/therundownai/p/DfQCWHZEreu/'}},
    ],
    'candidates': [
        {'title': 'An animator\'s viral gentleman helps New Yorkers', 'url': 'https://www.instagram.com/evolving.ai/reel/DfHwPJsgbeb/', 'place': 'sheet', 'date': '2026-10-30'},
        {'title': 'A Bible epic made from classical paintings', 'url': 'https://www.instagram.com/evolving.ai/reel/DfMf7sYgHIt/', 'place': 'sheet', 'date': '2026-11-01'},
        {'title': 'Games and worlds built in hours', 'url': 'https://www.instagram.com/evolving.ai/p/DfuWseGgGfl/', 'place': 'sheet', 'date': '2026-11-16'},
        {'title': 'A video site built from people\'s recommendations', 'url': 'https://www.instagram.com/therundownai/p/DfQCWHZEreu/', 'place': 'sheet', 'date': '2026-11-02'},
        {'title': 'Ten free animation and VFX tools', 'url': 'https://www.instagram.com/syntaix.ai/p/DfUpCCLiSfS/', 'place': 'sheet', 'date': '2026-11-04'},
        {'title': 'A late commentator\'s voice returns to a football game, with his family\'s blessing', 'url': 'https://www.videogameschronicle.com/news/ea-sports-fc-27-is-adding-an-ai-generated-john-motson-to-its-commentary-team-three-years-after-his-death/', 'place': 'news', 'date': '2026-11-25'},
        {'title': 'A basketball arena gets an AI partner on its videoboards', 'url': 'https://blog.google/products-and-platforms/products/gemini/gemini-golden-state/', 'place': 'news', 'date': '2026-11-24'},
        {'title': 'Independent artists get a paid route into AI training', 'url': 'https://www.hypebot.com/ai-companies-want-independent-music-this-time-theyre-asking-permission/', 'place': 'news', 'date': '2026-11-26'},
        {'title': 'A four-minute AI short wins a Grand Prix', 'url': 'https://www.bandt.com.au/jamin-tasker-wins-grand-prix-at-tbwas-disrupt-ai-film-festival/', 'place': 'news', 'date': '2026-11-25'},
        {'title': 'A first-time developer\'s game sells 100,000 copies in three days', 'url': 'https://automaton-media.com/articles/newsjp/20261119-479967/', 'place': 'news', 'date': '2026-11-19'},
        {'title': 'Nine in ten designers now use AI every week', 'url': 'https://kesq.com/stacker-ai/2026/11/25/web-designers-share-how-theyve-adapted-to-ai-in-2026/', 'place': 'news', 'date': '2026-11-25'},
        {'title': 'Creators can now have TikTok watch for fakes of their face', 'url': 'https://digitalmusicnews.com/2026/11/23/tiktok-likeness-detection-release', 'place': 'news', 'date': '2026-11-23'},
        {'title': 'Suno drops new parts straight into a producer\'s session', 'url': 'https://www.musicbusinessworldwide.com/suno-launches-bridge-an-app-that-drops-ai-stems-into-ableton-live/', 'place': 'news', 'date': '2026-11-16'},
        {'title': 'An AI-animated feature reaches cinemas on 4 December', 'url': 'https://filmthreat.com/features/the-first-ai-animated-feature-film-in-theaters-gods-dont-give-gifts-director-zack-london-talks-about-the-future-of-cinema/', 'place': 'news', 'date': '2026-11-05'},
        {'title': 'Authors start receiving AI settlement payments', 'url': 'https://authorsguild.org/news/anthropic-settlement-update-check-your-claim-by-november-20', 'place': 'news', 'date': '2026-11-23'},
        {'title': 'Your saved card: a positive ray of sunshine', 'url': 'https://www.instagram.com/p/DfAY9PWFuEX/', 'place': 'card', 'date': '2026-10-28'},
    ],
}

GN_FLOW_CARDS = lambda cover, s, close: [(cover[0], cover[1])] + [(x['headline'] + '.', x['what'].split('.')[0]) for x in s] + [(close[0], close[1])]

carousel(sat_weekly, GN_FLOW_CARDS(('This month AI helped four makers reach millions.', 'Four small portraits in a row: an animator, a filmmaker, a game maker, a builder'), sat_weekly['stories'], ('Each one did the part only they could do.', 'The four makers\' hands at work')), 'Good-news roundup, after the weekly roundup post in your sheet', 'https://www.instagram.com/evolving.ai/p/Dc_GTNigPhb/')

sat_fans = {
    'id': 'fanvoices', 'kind': 'good_news', 'format': 'Good-news carousel, 6 cards, 4:5', 'source_tag': 'trade_press', 'stories_to_find': True,
    'topic': 'sport fans getting the voices and moments they love back',
    'source': {'label': 'VGC, EA Sports FC 27 is adding an AI-generated John Motson to its commentary team (25 Nov 2026)', 'url': 'https://www.videogameschronicle.com/news/ea-sports-fc-27-is-adding-an-ai-generated-john-motson-to-its-commentary-team-three-years-after-his-death/'},
    'copy': 'A football game brought back the voice of John Motson with his family\'s blessing, paid for his likeness and voice. Three more stories of fans getting back what they love are still to find.',
    'hook': 'Football fans got Motty back, and his family said yes. Three more to find.',
    'pitch': {'see': 'A sheepskin coat on a commentary box chair, the microphone live.', 'lands': 'A voice fans grew up with, back with consent and payment.', 'why_now': 'Live in EA Sports FC 27 from 26 November 2026.', 'share': 'The voice of the game is back, and his son says it means an awful lot.'},
    'shape': 'theme', 'aim': 'interest', 'funny': 'The commentator who called 29 FA Cup finals is back for one more season, and still does not need a script.',
    'lookalike': {'pattern': GOODNEWS_FLOW, 'beats': 'https://www.instagram.com/evolving.ai/p/Dcs7D_6ADQB/', 'our_take': 'The post rounded up launches; ours rounds up fans getting something back.'},
    'learned_from': [LF_REAL],
    'stories': [
        {'headline': 'Football fans can hear John Motson commentate again', 'what': 'EA Sports FC 27 added an optional AI-recreated John Motson from 26 November, built from his original recordings with generative AI, with his widow\'s and son\'s permission; EA paid the family for the rights.', 'why': 'A much-loved voice is back with consent and payment.', 'kind': 'sports', 'helps': {'who': 'Football fans and Motson\'s family', 'how': 'happier'}, 'date': '2026-11-25', 'source': {'label': 'VGC, 25 Nov 2026', 'url': 'https://www.videogameschronicle.com/news/ea-sports-fc-27-is-adding-an-ai-generated-john-motson-to-its-commentary-team-three-years-after-his-death/'}, 'media': {'kind': 'photo', 'url': 'https://www.videogameschronicle.com/files/2026/11/ea-fc-motson-320x180.jpg'}},
    ],
}
carousel(sat_fans, [
    ('Fans got Motty back, and his family said yes.', 'A sheepskin coat on a commentary box chair'),
    ('The voice of 29 FA Cup finals, back in the game.', 'A game screen with the commentary option highlighted'),
    ('Story two, to find.', 'A blank card waiting for its picture'),
    ('Story three, to find.', 'A blank card waiting for its picture'),
    ('Story four, to find.', 'A blank card waiting for its picture'),
    ('What fans love, given back with a yes.', 'A crowd singing in the rain'),
], 'Good-news roundup, after the weekly roundup post in your sheet', 'https://www.instagram.com/evolving.ai/p/Dcs7D_6ADQB/')

sat_arena = {
    'id': 'arenanight', 'kind': 'good_news', 'format': 'Good-news carousel, 6 cards, 4:5', 'source_tag': 'radar', 'stories_to_find': True,
    'topic': 'a better night out at the game',
    'source': {'label': 'Google, How Gemini is changing the game for Golden State\'s organization and fans (24 Nov 2026)', 'url': 'https://blog.google/products-and-platforms/products/gemini/gemini-golden-state/'},
    'copy': 'The Warriors, the champion Valkyries and Chase Center put Gemini into the game night itself, through interactive videoboard features fans can join. Three more stories of a better night at the game are still to find.',
    'hook': 'The Warriors\' big screen now talks back. Three more to find.',
    'pitch': {'see': 'A packed arena, the giant videoboard answering a fan\'s question.', 'lands': 'A small, fun change to a night out at the game.', 'why_now': 'Announced 24 November 2026.', 'share': 'The arena screen that answers back.'},
    'shape': 'theme', 'aim': 'interest', 'funny': 'The videoboard finally has something to say besides "MAKE SOME NOISE".',
    'lookalike': {'pattern': GOODNEWS_FLOW, 'beats': 'https://www.instagram.com/evolving.ai/p/Dc_GTNigPhb/', 'our_take': 'The post rounded up the week in AI; ours rounds up better nights at the game.'},
    'learned_from': [LF_REAL],
    'stories': [
        {'headline': 'Warriors fans can play with the arena\'s big screen', 'what': 'Google Gemini is now the official AI assistant partner of the Golden State Warriors, the 2026 WNBA champion Valkyries and Chase Center, with interactive videoboard features inside the arena and digital features for fans at home.', 'why': 'Fans in the seats and at home get a new way to join the game night.', 'kind': 'sports', 'helps': {'who': 'Warriors and Valkyries fans', 'how': 'happier'}, 'date': '2026-11-24', 'source': {'label': 'Google, 24 Nov 2026', 'url': 'https://blog.google/products-and-platforms/products/gemini/gemini-golden-state/'}, 'media': {'kind': 'photo', 'url': 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Google_Gemini_1.width-1200.format-webp.webp'}},
    ],
}
carousel(sat_arena, [
    ('The arena\'s big screen now talks back.', 'A giant videoboard over a packed court'),
    ('Warriors and Valkyries fans join in from their seats.', 'A fan holding up a phone to the board'),
    ('Story two, to find.', 'A blank card waiting for its picture'),
    ('Story three, to find.', 'A blank card waiting for its picture'),
    ('Story four, to find.', 'A blank card waiting for its picture'),
    ('A better night out at the game.', 'Confetti over the court'),
], 'Good-news roundup, after the weekly roundup post in your sheet', 'https://www.instagram.com/evolving.ai/p/Dc_GTNigPhb/')

json.dump({'tue': tue, 'thu': thu, 'sat': [sat_weekly, sat_fans, sat_arena]}, open('docs/plans/2026-11-30-week/api/offdays.json', 'w'), indent=1, ensure_ascii=False)
print('tue', len(tue), 'thu', len(thu), 'sat 3')
