const axios = require("axios");

module.exports = async function (context, req) {
  try {
    const endpoint = process.env.VISION_ENDPOINT;
    const key = process.env.VISION_KEY;
    if (!endpoint || !key) {
      return (context.res = { status: 400, body: { error: "Set VISION_ENDPOINT and VISION_KEY to enable this feature" } });
    }

    const { imageUrl } = req.body || {};
    if (!imageUrl) return (context.res = { status: 400, body: { error: "imageUrl required" } });

    // Computer Vision v3.2 Analyze
    const url = `${endpoint.replace(/\/$/, "")}/vision/v3.2/analyze?visualFeatures=Tags,Description`;
    const resp = await axios.post(url, { url: imageUrl }, {
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/json"
      },
      timeout: 20000
    });

    const tags = (resp.data.tags || []).map(t => ({ name: t.name, confidence: t.confidence }));
    const caption = resp.data.description?.captions?.[0]?.text || "";

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { caption, tags, raw: resp.data }
    };
  } catch (err) {
    context.log.error(err?.response?.data || err);
    context.res = { status: 500, body: { error: err.message, details: err?.response?.data } };
  }
};
