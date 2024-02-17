const { WebClient } = require('@slack/web-api');
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

// SlackとOpenAIのクライアントを初期化
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// ここから可変
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
            const key = process.env.OPENAI_API_KEY; // 実際のAzure OpenAIキーに置き換えてください
            const endpoint = process.env.OPENAI_API_URL;
            const client = new OpenAIClient(endpoint, new AzureKeyCredential(key));
            context.log(`Your message is ${event.text}`);
            // ChatGPTからの応答を生成
            const messages = [
              { role: "system", content: "システムレベルのプロンプトでコンテキストを設定します。" },
              { role: "user", content: "ユーザーの質問や発言。" },
              // 必要に応じてさらにメッセージを追加
            ];
            const response = await client.streamChatCompletions("gpt-35-turbo", messages, { maxTokens: 128 });
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
