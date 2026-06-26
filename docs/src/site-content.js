export const siteContent = {
  en: {
    lang: 'en',
    ui: {
      skip: 'Skip to content',
      langLabel: 'Language',
      brandAria: 'GUI-Anything home',
      demoTabsAria: 'Demo scenarios',
      painAria: 'Common session questions',
      demoAria: 'GUI-Anything product demo',
      heroAnimAria: 'Interactive 3D scene: drag or scroll to explore; motes gather and follow your cursor over the knowledge tree',
    },
    nav: {
      demo: 'demo',
      problem: 'problem',
      capabilities: 'capabilities',
      contribute: 'contribute',
    },
    hero: {
      command: 'npm i -g gui-anything',
      title: 'Make Claude Code sessions readable.',
      lede:
        'GUI-Anything runs alongside Claude Code, turning intent, progress, and reusable experience into a clear thread.',
      ctaPrimary: 'View on GitHub',
      ctaSecondary: 'See how it works',
      proofLabel: 'What stays clear',
      proof: ['capture intent', 'flow timeline', 'local wiki'],
      product: {
        ariaLabel: 'GUI-Anything live observer preview',
        title: 'ga flow',
        mode: 'flow observer',
        claudeTitle: 'Claude Code',
        observerTitle: 'GUI-Anything',
        claudeLines: [
          '> try this direction',
          '> hit a bug',
          '> maybe add this module',
          '> keep this thought',
        ],
        cards: [
          {
            badge: 'Intent',
            title: 'What are you trying to do?',
            meta: 'keeps the intent in view',
          },
          {
            badge: 'Progress',
            title: 'Where did we turn?',
            meta: 'records the change of direction',
            active: true,
          },
          {
            badge: 'Note',
            title: 'What should survive?',
            meta: 'saved to your local wiki',
          },
        ],
        footer: [
          ['intent', 'what you meant'],
          ['flow', 'how it changed'],
          ['wiki', 'what stays useful'],
        ],
      },
    },
    demo: {
      tag: 'demo',
      title: 'A live observer for intent, flow, and knowledge.',
      hint: 'Switch tabs · scan cards · open notes · press ? in the observer',
      body: 'The chat keeps moving. The observer keeps the shape of the work.',
    },
    problem: {
      tag: 'pain points',
      pillars: [
        {
          id: 'no-structure',
          title: 'You cannot see the structure, only one long conversation.',
          fragments: [
            'Go in this direction ...',
            'There is a bug ...',
            'I want to add this module ...',
            'The docs are not synced yet ...',
          ],
          punchline: 'Where are we now?',
          reaction: '🤨',
          note: 'Claude Code is good at getting things done. It is not good at keeping your sense of direction visible in a long session.',
        },
        {
          id: 'evaporates',
          title: 'When the session ends, process knowledge evaporates.',
          fragments: [
            'What did we do this round ...',
            'How did we fix that error ...',
            'A new idea ...',
          ],
          punchline: 'Do I have to write the project report myself?',
          reaction: '😭',
          note: 'The process matters. It records how you arrived at the answer.',
        },
      ],
    },
    capabilities: {
      tag: 'capabilities',
      title: 'Four capabilities for readable Claude Code sessions.',
      body: 'GUI-Anything does not drive Claude Code. It models the session as intent, timeline, notification, and wiki artifacts so the interaction can be reviewed, resumed, and reused.',
      items: [
        {
          id: 'flow',
          title: 'Flow',
          text: 'Each exploration becomes a summary card: intent, turn, and current state.',
          preview: {
            kind: 'flow',
            label: 'observer',
            status: 'Live · Flow · readable session',
            explorations: [
              {
                compact: true,
                intentBadge: 'Intent',
                intentTitle: 'Find the current intent',
                toolMeta: 'Done · intent found · files checked',
              },
              {
                intentBadge: 'Turn',
                intentTitle: 'Move from copy to policy',
                toolMeta: 'Active · reason saved',
                running: true,
                summary: 'Tomorrow you need the reason more than the diff. This card keeps why the session changed direction.',
              },
            ],
          },
        },
        {
          id: 'notify',
          title: 'Notify',
          text: 'Step away from the desk. WeChat sends the progress that matters.',
          preview: {
            kind: 'wechat',
            contact: 'GUI-Anything',
            status: 'WeChat · now',
            meInitial: 'me',
            inputHint: 'Come back when review is needed',
            messages: [
              {
                from: 'ga',
                text: 'Claude is still running tests. 3 passed, 1 suite left.',
              },
              {
                from: 'ga',
                text: 'Done. The run is ready, and the summary is saved.',
              },
              {
                from: 'me',
                text: 'On my way back.',
              },
            ],
          },
        },
        {
          id: 'map',
          title: 'Map',
          text: 'The same session can appear as a text card, a terminal TUI, or a web GUI.',
          preview: {
            kind: 'visual',
            label: '3 visual strategies',
            status: 'text · TUI · GUI',
            modes: [
              {
                type: 'text',
                title: 'Text card',
                heading: 'What I learned',
                text: 'A short card keeps the lesson so you do not have to clean up notes later.',
              },
              {
                type: 'tui',
                title: 'Terminal TUI',
                lines: ['FLOW 03', 'Intent visible', 'Latest card pinned'],
              },
              {
                type: 'gui',
                title: 'Web GUI',
                nodes: [
                  { label: 'Explore' },
                  { label: 'Build', active: true },
                  { label: 'Verify' },
                ],
              },
            ],
          },
        },
        {
          id: 'wiki',
          title: 'Wiki',
          text: 'Useful experience becomes a personal wiki while the session is still fresh.',
          preview: {
            kind: 'wiki',
            root: 'wiki/',
            status: 'local files',
            treeLabel: 'Local wiki file tree',
            items: [
              { type: 'folder', name: 'knowledge', depth: 0 },
              { type: 'file', name: 'debugging-patterns.md', depth: 1, active: true },
              { type: 'folder', name: 'sessions', depth: 0 },
              { type: 'file', name: 'bundle.json', depth: 1 },
            ],
            fileTitle: '# Debugging note',
            excerpt: 'Keep the reason, the fix, and when it might help again. The wiki grows during the session.',
            path: 'wiki/knowledge/debugging-patterns.md',
          },
        },
      ],
    },
    lifecycle: {
      tag: 'lifecycle',
      title: 'From running to remembering.',
      body: '',
      items: [
        {
          id: 'before',
          title: 'Before',
          text: 'Attempts, errors, and decisions collect in one long chat.',
          scene: ['> scroll the chat again...', '> where was that fix?'],
        },
        {
          id: 'during',
          title: 'During',
          text: 'Claude keeps running. The right pane builds cards and a timeline.',
          scene: ['claude · running', 'observer · 3 cards · live'],
        },
        {
          id: 'after',
          title: 'After',
          text: 'The useful parts become wiki pages and a session you can replay.',
          scene: ['wiki/knowledge/', 'sessions/session-a/'],
        },
        {
          id: 'next',
          title: 'Next time',
          text: 'You continue from the saved shape of the work, not from memory.',
          scene: ['$ ga flow -c', 'resume · replay ready'],
        },
      ],
    },
    principles: {
      tag: 'principles',
      items: [
        { title: 'Observe, do not drive', text: 'Claude Code stays as it is. GUI-Anything reads and records the session.' },
        { title: 'Save what will be useful again', text: 'The wiki grows around turns, decisions, and reusable lessons.' },
        { title: 'Local by default', text: 'Timeline, map, and wiki files live in your project folder.' },
      ],
    },
    install: {
      tag: 'install',
      title: 'One command. Two panes.',
      body: 'Claude on the left, observer on the right.',
      steps: [
        { title: 'install', command: 'npm i -g gui-anything' },
        { title: 'run', command: 'ga flow' },
        { title: 'from source', command: 'git clone ... && ./scripts/setup.sh' },
      ],
      hint: 'deps missing?',
      doctor: 'ga doctor',
    },
    contribute: {
      tag: 'contribute',
      title: 'Contribute code.',
      body: 'Pick up an issue, send a PR, or improve the observer, wiki pipeline, notifications, or web GUI.',
      github: 'github',
      guide: 'contributing.md',
    },
    footer: {
      line: 'MIT · local by default · watches Claude, does not drive it',
      top: '^ back to top',
    },
    painLines: [
      'What did we actually do this round?',
      'How did we fix that error again?',
      'Where did we leave off yesterday?',
    ],
    painReaction: '🤨 😭 🧭',
    scenarioCopy: {
      idle: {
        title: 'Quiet start.',
        thesis: 'Claude is running. The observer waits for the first tool call before it starts drawing the timeline.',
        artifacts: [
          ['status', 'live · reading session log'],
          ['hint', 'focus observer, press ? for keys'],
          ['next', 'first work card opens flow view'],
        ],
      },
      flow: {
        title: 'The run, not the scrollback.',
        thesis: 'The full chat stays on the left. On the right, finished work becomes cards, with the newest one pinned at the bottom.',
        artifacts: [
          ['left', 'reads, edits, and test runs in one pane'],
          ['right', '4 tasks · 3 done · 1 summarizing'],
          ['pin', 'latest card stays at the bottom'],
        ],
      },
      timeline: {
        title: 'One thread in focus.',
        thesis: 'Timeline mode pulls one task forward, so you can see where you are without rereading everything.',
        artifacts: [
          ['toggle', 'g switches flowchart / timeline'],
          ['focus', 'active task highlighted in the rail'],
          ['calm', 'c compacts older cards in flow view'],
        ],
      },
      note: {
        title: 'Scratch notes, same session.',
        thesis: 'Press i for a notes column. Add one plain text line per thought and stay in the same layout.',
        artifacts: [
          ['width', 'notes open as a third column (~28%)'],
          ['input', 'plain text only, one thought per note'],
          ['keys', 'Esc or i to close · g for timeline'],
        ],
      },
    },
  },
  zh: {
    lang: 'zh',
    ui: {
      skip: '跳到正文',
      langLabel: '语言',
      brandAria: 'GUI-Anything 首页',
      demoTabsAria: '演示场景',
      painAria: '长会话里常见的追问',
      demoAria: 'GUI-Anything 产品演示',
      heroAnimAria: '可交互 3D 场景：移动鼠标，光点会追随聚集；拖动或滚轮可环顾知识树',
    },
    nav: {
      demo: '演示',
      problem: '问题',
      capabilities: '能力',
      contribute: '贡献',
    },
    hero: {
      command: 'npm i -g gui-anything',
      title: '让 Claude Code 长会话，\n有清晰脉络。',
      lede:
        'GUI-Anything 伴随 Claude Code 运行，将会话中的意图、进展与可复用经验整理成清晰脉络。',
      ctaPrimary: '查看 GitHub',
      ctaSecondary: '看看怎么用',
      proofLabel: '留下清楚的东西',
      proof: ['捕获意图', '会话时间线', '本地知识库'],
      product: {
        ariaLabel: 'GUI-Anything 实时观察器预览',
        title: 'ga flow',
        mode: 'flow observer',
        claudeTitle: 'Claude Code',
        observerTitle: 'GUI-Anything',
        claudeLines: [
          '> 按这个方向试试',
          '> 有 bug',
          '> 也许要加这个模块',
          '> 这个想法先记下来',
        ],
        cards: [
          {
            badge: '意图',
            title: '这轮想做什么？',
            meta: '意图一直看得见',
          },
          {
            badge: '进度',
            title: '现在走到哪了？',
            meta: '转向和检查都记下来',
            active: true,
          },
          {
            badge: '笔记',
            title: '哪些想法值得留下？',
            meta: '存成本地知识',
          },
        ],
        footer: [
          ['intent', '你真正想做什么'],
          ['flow', '过程怎么变化'],
          ['wiki', '哪些以后还会用'],
        ],
      },
    },
    demo: {
      tag: '演示',
      title: '实时观察意图、过程和知识。',
      hint: '切换标签 · 扫卡片 · 打开笔记 · 在 observer 按 ?',
      body: '对话继续向前，右栏留下清楚的过程。',
    },
    problem: {
      tag: '痛点',
      pillars: [
        {
          id: 'no-structure',
          title: '看不见「结构」，只有一条长对话',
          fragments: [
            '按照这个方向执行 …',
            '有 bug …',
            '我想要加这个模块 …',
            '文档还没有同步更新 …',
          ],
          punchline: '我们做到哪了？',
          reaction: '🤨',
          note: 'Claude Code 擅长把事做完，不擅长帮你在长会话里保持方向感。',
        },
        {
          id: 'evaporates',
          title: '会话结束 ≈ 过程知识蒸发',
          fragments: [
            '这轮做了啥 …',
            '这次报错怎么处理的 …',
            '一个新想法 …',
          ],
          punchline: '我还要自己整理项目报告？',
          reaction: '😭',
          note: '过程很重要 —— 它记录你怎么走到答案。',
        },
      ],
    },
    capabilities: {
      tag: '能力',
      title: '四种能力，让长会话保持清晰。',
      body: 'GUI-Anything 不驱动 Claude Code。它把会话建模为意图、时间线、通知和 wiki 资产，让交互过程可以回看、继续和复用。',
      items: [
        {
          id: 'flow',
          title: '心流',
          text: '每段探索生成一张总结卡片：意图、转向和当前状态一眼可见。',
          preview: {
            kind: 'flow',
            label: 'observer',
            status: 'Live · 心流 · 长会话看得懂',
            explorations: [
              {
                compact: true,
                intentBadge: '意图',
                intentTitle: '先看清当前意图',
                toolMeta: '完成 · 用户意图 · 已读文件',
              },
              {
                intentBadge: '转向',
                intentTitle: '从改文案转去确认策略',
                toolMeta: '进行中 · 原因已记录',
                running: true,
                summary:
                  '明天真正有用的不是 diff，而是为什么换方向、查过什么、还有什么判断要记住。',
              },
            ],
          },
        },
        {
          id: 'notify',
          title: '通知',
          text: '离开电脑时，微信发来进度和需要你回来看的一刻。',
          preview: {
            kind: 'wechat',
            contact: 'GUI-Anything',
            status: '微信 · 刚刚',
            meInitial: '我',
            inputHint: '需要你回来时再提醒',
            messages: [
              {
                from: 'ga',
                text: 'Claude 还在跑测试。3 个已通过，还剩 1 组。',
              },
              {
                from: 'ga',
                text: '完成了。可以回来 review，摘要也保存好了。',
              },
              {
                from: 'me',
                text: '好的，我马上回来。',
              },
            ],
          },
        },
        {
          id: 'map',
          title: '可视化',
          text: '同一轮会话，可以切成知识卡片、终端 TUI 或网页 GUI。',
          preview: {
            kind: 'visual',
            label: '三种可视化策略',
            status: '文本 · TUI · GUI',
            modes: [
              {
                type: 'text',
                title: '文本知识卡片',
                heading: '这次学到什么',
                text: '值得留下的判断先收成卡片，事后不用再补笔记。',
              },
              {
                type: 'tui',
                title: '终端 TUI',
                lines: ['FLOW 03', '意图一直可见', '最新卡片钉住'],
              },
              {
                type: 'gui',
                title: '网页 GUI',
                nodes: [
                  { label: '探索' },
                  { label: '实现', active: true },
                  { label: '验证' },
                ],
              },
            ],
          },
        },
        {
          id: 'wiki',
          title: '沉淀',
          text: '有用经验沉淀进个人 wiki。会话继续跑，知识也跟着长出来。',
          preview: {
            kind: 'wiki',
            root: 'wiki/',
            status: 'local files',
            treeLabel: '本地 wiki 文件树',
            items: [
              { type: 'folder', name: 'knowledge', depth: 0 },
              { type: 'file', name: 'debugging-patterns.md', depth: 1, active: true },
              { type: 'folder', name: 'sessions', depth: 0 },
              { type: 'file', name: 'bundle.json', depth: 1 },
            ],
            fileTitle: '# 调试经验',
            excerpt: '留下原因、修法和下次什么时候能复用。wiki 会在会话里慢慢长出来。',
            path: 'wiki/knowledge/debugging-patterns.md',
          },
        },
      ],
    },
    lifecycle: {
      tag: '生命周期',
      title: '从运行到沉淀，顺着发生。',
      body: '',
      items: [
        {
          id: 'before',
          title: '之前',
          text: '尝试、报错和判断，都挤在一条长对话里。',
          scene: ['> 又要往上翻对话...', '> 那次修复在哪？'],
        },
        {
          id: 'during',
          title: '之中',
          text: 'Claude 继续跑，右栏同步生成卡片和时间线。',
          scene: ['claude · 运行中', 'observer · 3 张卡片 · live'],
        },
        {
          id: 'after',
          title: '之后',
          text: '关键经验写入知识库，会话也能回放。',
          scene: ['wiki/knowledge/', 'sessions/session-a/'],
        },
        {
          id: 'next',
          title: '下次',
          text: '从保存的脉络接着做，不靠回忆补现场。',
          scene: ['$ ga flow -c', 'resume · 可回放'],
        },
      ],
    },
    principles: {
      tag: '原则',
      items: [
        { title: '观察会话，不接管 Claude', text: 'Claude Code 保持原样，GUI-Anything 只负责读和记。' },
        { title: '只保存值得复用的经验', text: '转向、判断和可复用做法，会慢慢进入 wiki。' },
        { title: '本地优先', text: '时间线、流程图、wiki 都在你的项目目录里。' },
      ],
    },
    install: {
      tag: '安装',
      title: '一条命令，两栏界面。',
      body: '左边 Claude，右边 observer。',
      steps: [
        { title: '安装', command: 'npm i -g gui-anything' },
        { title: '运行', command: 'ga flow' },
        { title: '源码', command: 'git clone ... && ./scripts/setup.sh' },
      ],
      hint: '依赖缺了？',
      doctor: 'ga doctor',
    },
    contribute: {
      tag: '贡献',
      title: '欢迎代码贡献。',
      body: '从 issue 开始，提一个 PR。observer、wiki 链路、通知、网页 GUI 都欢迎改进。',
      github: 'github',
      guide: 'contributing.md',
    },
    footer: {
      line: 'MIT · 本地优先 · 只看 Claude，不接管它',
      top: '^ 回到顶部',
    },
    painLines: [
      '这轮到底做了啥？',
      '上次那个报错怎么修的？',
      '我们做到哪了？',
    ],
    painReaction: '🤨 😭 🧭',
    scenarioCopy: {
      idle: {
        title: '安静开局。',
        thesis: 'Claude 在跑。observer 等第一次 tool call，时间线才会有第一条记录。',
        artifacts: [
          ['状态', 'live · 读取会话记录'],
          ['提示', '聚焦 observer，按 ? 看快捷键'],
          ['下一步', '第一张工作卡片打开 flow 视图'],
        ],
      },
      flow: {
        title: '看运行，不是翻日志。',
        thesis: '左栏完整对话。右栏已完成的 work 堆成卡片，当前那张钉在底部。',
        artifacts: [
          ['左栏', '读取、编辑、测试跑在同一面板'],
          ['右栏', '4 段工作 · 3 完成 · 1 在摘要'],
          ['钉住', '最新卡片在底部'],
        ],
      },
      timeline: {
        title: '单线程聚焦。',
        thesis: 'Timeline 把一段工作拉到前台，带标题和高亮，不用重读全文也能定位。',
        artifacts: [
          ['切换', 'g 在流程图 / 时间线间切换'],
          ['焦点', '当前工作在节点轨高亮'],
          ['安静', 'c 在 flow 视图压缩旧卡片'],
        ],
      },
      note: {
        title: '随手记，不离开双栏。',
        thesis: '按 i 打开 notes 列。每条一行纯文本，不用跳出 Claude | observer 布局。',
        artifacts: [
          ['宽度', 'notes 作为第三列打开（约 28%）'],
          ['输入', '纯文本，一条笔记一个想法'],
          ['按键', 'Esc 或 i 关闭 · g 切 timeline'],
        ],
      },
    },
  },
};

const LOCALE_KEY = 'ga-docs-locale';

export function resolveInitialLocale() {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(LOCALE_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  const lang = window.navigator.language?.toLowerCase() ?? '';
  return lang.startsWith('zh') ? 'zh' : 'en';
}

export function persistLocale(locale) {
  window.localStorage.setItem(LOCALE_KEY, locale);
}
