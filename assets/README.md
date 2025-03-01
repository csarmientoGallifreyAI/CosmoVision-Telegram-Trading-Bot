# Bot Assets

This directory contains assets used by the Telegram bot.

## Bot Profile Photo

To set a custom profile photo for your bot:

1. **Manual Method (Recommended)**: Use BotFather's `/setuserpic` command in Telegram to set the profile photo directly.

2. **Automated Method**: Place a JPEG image named `bot-profile.jpg` in this directory. The bot setup script will automatically use this image when initializing the bot's profile.

Requirements for the profile photo:

- File format: JPEG (`.jpg`)
- Filename: `bot-profile.jpg`
- Recommended dimensions: 640x640 pixels (square)
- File size: Less than 100KB for optimal performance

If no profile photo is provided, the bot will use the default Telegram avatar.
