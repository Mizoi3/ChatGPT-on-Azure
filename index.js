const { WebClient } = require('@slack/web-api');
const { OpenAI } = require('openai');

// SlackとOpenAIのクライアントを初期化
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const openAi = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function (context, req) {
    // チャレンジリクエストに対応
    if (req.body.challenge) {
        context.res = {
            body: req.body.challenge
        };
        return;
    }

    // app_mentionイベントを処理
    const event = req.body.event;
    let reply = ""; // 修正: reply変数をここで宣言
    if (event && event.type === 'app_mention') {
        try {
            context.log(`Your message is ${event.text}`);
            // ChatGPTからの応答を生成
            const response = await openAi.createChatCompletion({
                messages: [{
                        role: "user",
                        content: event.text,
                    }],
                max_tokens: 800,
                temperature: 0.7,
                frequency_penalty: 0,
                presence_penalty: 0,
                top_p: 0.95,
            });
            reply = response.data.choices[0].message.content; // 修正: 変数のスコープ問題を解決
            context.log(reply);

            // Slackに応答を投稿
            await slackClient.chat.postMessage({
                channel: event.channel,
                text: reply,
                thread_ts: event.ts, // スレッド内で返信
            });

            context.res = { body: "Success" };
        } catch (error) {
            context.log.error(error);
            context.res = {
                status: 500,
                body: "Internal Server Error",
            };
        }
    } else {
        // イベントがapp_mention以外の場合は無視
        context.res = { status: 200, body: 'Ignored event' };
    }
};
