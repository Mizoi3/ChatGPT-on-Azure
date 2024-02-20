const { WebClient } = require('@slack/web-api');
// const fetch = require('node-fetch');

// Slackクライアントの初期化
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

async function fetchThreadMessages(channel, threadTs) {
    const response = await slackClient.conversations.replies({
        channel: channel,
        ts: threadTs,
    });
    if (!response.ok) {
        throw new Error('Failed to fetch thread messages');
    }
    return response.messages;
}

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
        // app_mentionイベントを処理する部分に以下のコードを追加します
        const threadMessages = await fetchThreadMessages(event.channel, event.thread_ts || event.ts);
        
        // コンテキストとして利用するメッセージを抽出・整形
        const contextMessages = threadMessages.map(msg => {
            return {
                role: msg.user === process.env.GPT_BOT_USER_ID ? "system" : "user",
                content: msg.text.replace(/<@[^>]+>/g, '').trim() // メンションを取り除く
            };
        }).slice(-process.env.MAX_CONTEXT_LENGTH); // 最新の5件のメッセージを利用する例

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
            model = process.env.OPENAI_MODEL,
            messages: [...contextMessages, ...messages],
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
        context.log.error(`Error occurred: ${error.message}`);
        await slackClient.chat.postMessage({
            channel: event.channel,
            text: "エラーが発生しました。もう一度試してください。",
            thread_ts: event.ts,
        });
        context.res = { status: 500, body: "Internal Server Error" };
        }

    } else {
        // イベントがapp_mention以外の場合は無視
        context.res = { status: 200, body: 'Ignored event' };
    }
};
