const { WebClient } = require('@slack/web-api');
// const fetch = require('node-fetch');

// Slackクライアントの初期化
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

module.exports = async function (context, req) {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    // チャレンジリクエストに対応
    if (req.body.challenge) {
        context.res = { body: req.body.challenge };
        return;
    }

    // app_mentionイベントを処理
    const event = req.body.event;
    if (event && event.type === 'app_mention') {
        context.log(`Your message: ${event.text}`)
        const apiKey = process.env.OPENAI_API_KEY;
        const model = `gpt-35-turbo`;
        const endpoint = process.env.OPENAI_API_ENDPOINT;

        const headers = {
            'Content-Type': 'application/json',
            'api-key': apiKey
        };

        const messages = [
            { 
                role: "system", 
                content: process.env.CHAT_GPT_SYSTEM_PROMPT 
            },
            { 
                role: "user", 
                content: event.text // ここにはSlackイベントから受け取ったユーザーのメッセージが入ります。
            }
        ];

        const body = JSON.stringify({
            messages: messages,
            max_tokens: 800,
            temperature: 0.7,
            frequency_penalty: 0,
            presence_penalty: 0,
            top_p: 0.95,
            stop: null
        });

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: body
            });

        const data = await response.json();

        // 応答からテキストを抽出
        const replyText = data.choices[0].message.content;

        // Slackに応答を投稿
        await slackClient.chat.postMessage({
            channel: event.channel,
            text: replyText,
            thread_ts: event.ts, // スレッド内で返信
        });

        context.res = { body: "Success" };

        } catch (error) {
            context.log.error(error);
            context.res = { status: 500, body: "Internal Server Error" };
        }

    } else {
        // イベントがapp_mention以外の場合は無視
        context.res = { status: 200, body: 'Ignored event' };
    }
};
