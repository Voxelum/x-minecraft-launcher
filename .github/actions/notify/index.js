const core = require("@actions/core");
const { request } = require("undici");

const version = core.getInput("version");

async function generateKook() {
  const changelogs = await (
    await request(
      `https://raw.githubusercontent.com/voxelum/xmcl-page/master/src/pages/zh/changelogs/${version}.md`
    )
  ).body.text();

  const lines = changelogs.split("\n");
  lines = lines.slice(lines.lastIndexOf("---") + 1);

  const features = [];
  const fixes = [];
  const refactors = [];

  let current = undefined;
  for (const line of lines) {
    if (line.startsWith("###") && line.indexOf("特性") !== -1) {
      current = features;
    } else if (line.startsWith("###") && line.indexOf("修复") !== -1) {
      current = fixes;
    } else if (line.startsWith("###") && line.indexOf("重构") !== -1) {
      current = refactors;
    } else {
      if (current && line.length > 0) {
        current.push(line);
      }
    }
  }

  const sections = [];
  if (features.length > 0) {
    sections.push({
      type: "section",
      text: {
        type: "kmarkdown",
        content: ["🐛 **新特性**", ...features].join("\n"),
      },
    });
  }
  if (fixes.length > 0) {
    sections.push({
      type: "section",
      text: {
        type: "kmarkdown",
        content: ["🐛 **修复和补丁**", ...fixes].join("\n"),
      },
    });
  }
  if (refactors.length > 0) {
    sections.push({
      type: "section",
      text: {
        type: "kmarkdown",
        content: ["🏗️ **重构**", ...refactors].join("\n"),
      },
    });
  }
  const content = [
    {
      type: "card",
      theme: "info",
      size: "lg",
      modules: [
        {
          type: "header",
          text: {
            type: "plain-text",
            content: `${version} 发布`,
          },
        },
        ...sections,
        {
          type: "action-group",
          elements: [
            {
              type: "button",
              theme: "primary",
              value: "https://xmcl.app",
              click: "link",
              text: {
                type: "plain-text",
                content: "去官网下载",
              },
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "plain-text",
              content: "本消息由 Github Action 自动发布",
            },
          ],
        },
      ],
    },
  ];

  console.log(`Send kook message`);
  console.log(content);

  const response = await request(
    "https://www.kookapp.cn/api/v3/message/create",
    {
      method: "POST",
      body: JSON.stringify({
        type: 10,
        target_id: "9742373943819237",
        content: JSON.stringify(content),
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${core.getInput("token")}`,
      },
    }
  );
  console.log("kook response: " + response.statusCode);
  const body = await response.body.text();
  console.log(body);
}

async function generateDiscord() {
  const changelogs = await (
    await request(
      `https://raw.githubusercontent.com/voxelum/xmcl-page/master/src/pages/en/changelogs/${version}.md`
    )
  ).body.text();

  const lines = changelogs.split("\n");

  const features = [];
  const fixes = [];
  const refactors = [];

  let current = undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "### 🐛 Bug Fixes & Patches") {
      current = fixes;
    } else if (line === "### 🏗️ Refactors") {
      current = refactors;
    } else if (line === "### 🚀 Features") {
      current = features;
    } else {
      if (current) {
        current.push(line);
      }
    }
  }

  const fields = [];
  if (features.length > 0) {
    fields.push({
      name: "### 🚀 Features",
      value: features.join("\n"),
    });
  }
  if (fixes.length > 0) {
    fields.push({
      name: "### 🐛 Bug Fixes & Patches",
      value: fixes.join("\n"),
    });
  }
  if (refactors.length > 0) {
    fields.push({
      name: "### 🏗️ Refactors",
      value: refactors.join("\n"),
    });
  }

  const embeds = [
    {
      color: 2021216,
      title: `v${version}`,
      url: `https://github.com/voxlum/x-minecraft-launcher/releases/${version}`,
      fields: fields,
    },
  ];

  const payload = {
    username: "Github",
    embeds,
  };

  console.log("send discord");
  console.log(payload);
  const response = await request(
    core.getInput("discord"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  console.log('discord response: ' + response.statusCode)
  console.log(await response.body.text())
}

generateKook();
generateDiscord();
