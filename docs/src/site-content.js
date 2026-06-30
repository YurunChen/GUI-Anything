const CBTI_ITEMS = [
  {
    code: 'ARCH',
    name: { en: 'Architecture Smith', 'zh-Hans': '架构匠' },
    rarity: 'epic',
    intro: {
      en: 'Draws the blueprint before placing the first brick.',
      'zh-Hans': '先把蓝图画完，再动第一砖。',
    },
    style: { en: 'Plan-first builder', 'zh-Hans': '规划先行' },
  },
  {
    code: 'SHIP',
    name: { en: 'One-Shot Shipper', 'zh-Hans': '一击交付者' },
    rarity: 'epic',
    intro: {
      en: 'Code that ships is the code that counts.',
      'zh-Hans': '能上线的代码才是好代码。',
    },
    style: { en: 'Outcome driven', 'zh-Hans': '结果导向' },
  },
  {
    code: 'REFAC',
    name: { en: 'Refactor Purist', 'zh-Hans': '重构洁癖' },
    rarity: 'rare',
    intro: {
      en: 'It runs, but that does not mean it is acceptable.',
      'zh-Hans': '它能跑，但我忍不了。',
    },
    style: { en: 'Detail polisher', 'zh-Hans': '打磨细节' },
  },
  {
    code: 'REUSE',
    name: { en: 'Reuse Master', 'zh-Hans': '复用大师' },
    rarity: 'uncommon',
    intro: {
      en: 'There are enough wheels; time to assemble.',
      'zh-Hans': '轮子够多了，我来组装。',
    },
    style: { en: 'Composes existing leverage', 'zh-Hans': '站在巨人肩上' },
  },
  {
    code: 'PIONEER',
    name: { en: 'Path Pioneer', 'zh-Hans': '拓荒者' },
    rarity: 'rare',
    intro: { en: 'No path? Makes one.', 'zh-Hans': '没有路？那就踩一条出来。' },
    style: { en: 'Explores unknown ground', 'zh-Hans': '敢闯无人区' },
  },
  {
    code: 'TINKER',
    name: { en: 'Tinker Artisan', 'zh-Hans': '试错工匠' },
    rarity: 'common',
    intro: {
      en: 'Errors are a conversation with the machine.',
      'zh-Hans': '报错是我和机器的对话。',
    },
    style: { en: 'Learns by trying', 'zh-Hans': '边错边学' },
  },
  {
    code: 'DIVER',
    name: { en: 'Deep Diver', 'zh-Hans': '深潜员' },
    rarity: 'rare',
    intro: {
      en: 'Can dig one problem all the way down.',
      'zh-Hans': '一个问题能挖到地心。',
    },
    style: { en: 'Follows depth', 'zh-Hans': '钻到底' },
  },
  {
    code: 'SPARK',
    name: { en: 'Idea Fountain', 'zh-Hans': '点子喷泉' },
    rarity: 'uncommon',
    intro: {
      en: 'Has ten ideas for every commit.',
      'zh-Hans': '想法比 commit 多十倍。',
    },
    style: { en: 'Idea-heavy explorer', 'zh-Hans': '灵感爆棚' },
  },
  {
    code: 'PIVOT',
    name: { en: 'Pivot Master', 'zh-Hans': '转向大师' },
    rarity: 'uncommon',
    intro: {
      en: 'If the direction is wrong, turns fast.',
      'zh-Hans': '方向不对，换。',
    },
    style: { en: 'Flexible route switching', 'zh-Hans': '灵活掉头' },
  },
  {
    code: 'SCOUT',
    name: { en: 'Path Scout', 'zh-Hans': '探路侦察兵' },
    rarity: 'common',
    intro: {
      en: 'Maps the terrain before touching the code.',
      'zh-Hans': '先摸清地形再下手。',
    },
    style: { en: 'Explore before acting', 'zh-Hans': '谋定后动' },
  },
  {
    code: 'STEADY',
    name: { en: 'Steady Shipper', 'zh-Hans': '稳健交付者' },
    rarity: 'common',
    intro: {
      en: 'Not flashy, but every step counts.',
      'zh-Hans': '不快，但每步都算数。',
    },
    style: { en: 'Steady execution', 'zh-Hans': '稳扎稳打' },
  },
  {
    code: 'FIRE',
    name: { en: 'Firefighter', 'zh-Hans': '救火队员' },
    rarity: 'uncommon',
    intro: {
      en: 'Goes wherever the error is burning.',
      'zh-Hans': '哪里报错我去哪里。',
    },
    style: { en: 'Incident fixer', 'zh-Hans': '救场专精' },
  },
  {
    code: 'MARATHON',
    name: { en: 'Marathon Runner', 'zh-Hans': '长跑者' },
    rarity: 'rare',
    intro: {
      en: 'Keeps going when the road gets dark.',
      'zh-Hans': '一条道走到黑，黑了点灯继续。',
    },
    style: { en: 'Long-haul stamina', 'zh-Hans': '持久续航' },
  },
  {
    code: 'NIGHT',
    name: { en: 'Night Walker', 'zh-Hans': '夜行者' },
    rarity: 'rare',
    intro: {
      en: 'The best ideas arrive around 3 a.m.',
      'zh-Hans': '灵感都在凌晨三点找上门。',
    },
    style: { en: 'Moonlight coder', 'zh-Hans': '月光码农' },
  },
  {
    code: 'CHILL',
    name: { en: 'Chill Coder', 'zh-Hans': '佛系码农' },
    rarity: 'common',
    intro: {
      en: 'If it runs, optimization can wait its turn.',
      'zh-Hans': '能跑就行，缘分到了再优化。',
    },
    style: { en: 'Relaxed iteration', 'zh-Hans': '随缘开发' },
  },
  {
    code: 'STAR',
    name: { en: 'Hexagon Ace', 'zh-Hans': '六边形战士' },
    rarity: 'legendary',
    intro: {
      en: 'Breadth, depth, delivery: somehow all of it.',
      'zh-Hans': '广度深度交付全都要，老天爷赏饭。',
    },
    style: { en: 'All-rounder', 'zh-Hans': '全能' },
  },
  {
    code: 'OWL',
    name: { en: 'Night Owl', 'zh-Hans': '夜枭' },
    rarity: 'hidden',
    intro: {
      en: 'Inspiration and dark circles come online together.',
      'zh-Hans': '灵感与黑眼圈同时上线。',
    },
    style: { en: 'Late-night species', 'zh-Hans': '深夜物种' },
  },
  {
    code: 'VOID',
    name: { en: 'No Sediment Found', 'zh-Hans': '查无沉淀' },
    rarity: 'hidden',
    intro: {
      en: 'No durable project knowledge has settled yet.',
      'zh-Hans': '你的项目还没沉淀下任何知识。',
    },
    style: { en: 'Unclassified', 'zh-Hans': '未知分类' },
  },
  {
    code: 'GHOST',
    name: { en: 'Halfway Ghost', 'zh-Hans': '半途魂' },
    rarity: 'hidden',
    intro: {
      en: 'Too many tasks stopped halfway through.',
      'zh-Hans': '太多任务停在了一半。',
    },
    style: { en: 'Interrupted flow', 'zh-Hans': '半途而废' },
  },
];

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
    },
    nav: {
      demo: 'demo',
      moments: 'moments',
      problem: 'problem',
      capabilities: 'capabilities',
      cbti: 'CBTI',
      lifecycle: 'lifecycle',
      contribute: 'contribute',
    },
    hero: {
      title: 'Make Claude Code sessions readable.',
      lede:
        'GUI-Anything runs alongside Claude Code, turning intent, progress, and reusable experience into a clear thread.',
      ctaPrimary: 'View on GitHub',
      proofLabel: 'What stays clear',
      proof: ['intent stays visible', 'work becomes a timeline', 'project story is preserved', 'experience becomes memory'],
    },
    demo: {
      tag: 'demo',
      title: 'A live companion for intent, flow, and knowledge.',
      hint: 'A long coding session becomes readable while it is still happening.',
      body: 'The chat keeps moving. The right pane keeps the shape of the work.',
      callouts: {
        flow: [
          { target: 'intent', label: 'Intent stays attached to each step' },
          { target: 'knowledge', label: 'Relevant memory appears in context' },
          { target: 'running', label: 'Current work stays easy to find' },
        ],
        timeline: [
          { target: 'focus', label: 'Current focus' },
          { target: 'tree', label: 'Work map' },
        ],
        workspace: [
          { target: 'workspace', label: 'Project structure' },
          { target: 'trace', label: 'Recent activity' },
        ],
        note: [
          { target: 'notes', label: 'Session notes' },
        ],
        knowledge: [
          { target: 'knowledge', label: 'Relevant prior context' },
          { target: 'wiki', label: 'Useful lesson saved' },
        ],
        replay: [
          { target: 'replay', label: 'Saved session story' },
          { target: 'bundle', label: 'Original reasoning preserved' },
          { target: 'html', label: 'Project narrative ready to share' },
        ],
      },
    },
    moments: {
      title: 'Jump to a product moment',
      body: 'Each card highlights a different way the session becomes easier to understand.',
      items: [
        {
          id: 'timeline',
          scenarioId: 'flow',
          title: 'Live timeline',
          text: 'Intent badges, summaries, and a running card at the bottom.',
        },
        {
          id: 'knowledge',
          scenarioId: 'knowledge',
          title: 'KNOWLEDGE hit',
          text: 'Relevant prior context appears while Claude is still running.',
        },
        {
          id: 'flowchart',
          scenarioId: 'timeline',
          title: 'Flowchart focus',
          text: 'Pivots and the active branch become a readable map.',
        },
        {
          id: 'workspace',
          scenarioId: 'workspace',
          title: 'Workspace view',
          text: 'Project structure and recent activity stay beside the conversation.',
        },
        {
          id: 'replay',
          scenarioId: 'replay',
          title: 'Strict replay',
          text: 'A saved session can be reviewed with its original reasoning intact.',
        },
        {
          id: 'notes',
          scenarioId: 'note',
          title: 'Session notes',
          text: 'Quick observations stay attached to the same work session.',
        },
      ],
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
      body: 'GUI-Anything keeps the core session surface readable through intent, timeline, notification, and reusable memory, so the interaction can be reviewed, resumed, and reused.',
      items: [
        {
          id: 'flow',
          title: 'Flow',
          text: 'Each work step becomes a summary card: intent, turn, and current state.',
          preview: {
            kind: 'flow',
            label: 'session view',
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
          text: 'Useful experience becomes reusable project memory while the session is still fresh.',
          preview: {
            kind: 'wiki',
            root: 'Memory',
            status: 'saved insights',
            treeLabel: 'Project memory',
            items: [
              { type: 'folder', name: 'Decisions', depth: 0 },
              { type: 'file', name: 'Debugging patterns', depth: 1, active: true },
              { type: 'folder', name: 'Sessions', depth: 0 },
              { type: 'file', name: 'Readable recap', depth: 1 },
            ],
            fileTitle: '# Debugging note',
            excerpt: 'Keep the reason, the fix, and when it might help again. Project memory grows during the session.',
            path: 'Reusable project memory',
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
          scene: ['claude · running', 'right pane · 3 cards · live'],
        },
        {
          id: 'after',
          title: 'After',
          text: 'The useful parts become reusable memory, replayable context, and a project story.',
          scene: ['project memory', 'saved session', 'shareable story'],
        },
        {
          id: 'next',
          title: 'Next time',
          text: 'You continue from the saved shape of the work.',
          scene: ['resume with context', 'reasoning preserved'],
        },
        {
          id: 'sidecar',
          title: 'Share',
          text: 'The work can become a readable project narrative for teammates or future you.',
          scene: ['project story', 'evolution timeline'],
        },
      ],
    },
    cbti: {
      tag: 'CBTI',
      title: 'CBTI: Claude MBTI for coding sessions.',
      body: 'GUI-Anything reads how you ask and how a coding session unfolds, then turns that shape into a playful CBTI profile.',
      galleryLabel: 'CBTI Claude MBTI type gallery',
      items: CBTI_ITEMS,
    },
    principles: {
      tag: 'principles',
      items: [
        { title: 'Native Claude, visible work', text: 'Claude Code stays as it is. GUI-Anything makes the session easier to follow.' },
        { title: 'Save what will be useful again', text: 'Decisions, turns, and reusable lessons become project memory.' },
        { title: 'Local by default', text: 'The timeline, map, and memory stay with your project.' },
      ],
    },
    contribute: {
      tag: 'contribute',
      title: 'Contribute code.',
      body: 'Pick up an issue, send a PR, or improve the product experience.',
      github: 'Issues',
      guide: 'Contributor guide',
    },
    footer: {
      line: 'MIT · local by default · keeps coding sessions readable',
      top: 'Back to top',
      readme: 'GitHub README',
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
        thesis: 'Claude is running. GUI-Anything begins building a readable timeline as the work takes shape.',
        artifacts: [
          ['status', 'live · waiting for work'],
          ['shape', 'timeline appears as context grows'],
          ['next', 'first work card appears'],
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
        thesis: 'Timeline mode pulls one task forward, with title and highlight for quick orientation.',
        artifacts: [
          ['map', 'flowchart and timeline stay connected'],
          ['focus', 'active task highlighted in the rail'],
          ['calm', 'older work stays out of the way'],
        ],
      },
      workspace: {
        title: 'The project shape beside the conversation.',
        thesis: 'Workspace mode shows the parts of the project that matter to the current session.',
        artifacts: [
          ['tree', 'project areas in view'],
          ['active', 'current work marked clearly'],
          ['trace', 'recent activity summarized'],
        ],
      },
      note: {
        title: 'Scratch notes, same session.',
        thesis: 'Quick notes stay beside the work, so decisions and thoughts do not drift away.',
        artifacts: [
          ['notes', 'side thoughts stay attached'],
          ['input', 'one thought per note'],
          ['context', 'conversation and notes stay together'],
        ],
      },
      knowledge: {
        title: 'Prior memory while the run continues.',
        thesis: 'Relevant past experience appears at the moment it can help the current work.',
        artifacts: [
          ['hit', 'relevant lesson found'],
          ['save', 'useful knowledge preserved'],
          ['reuse', 'past decisions become current context'],
        ],
      },
      replay: {
        title: 'Honest resume.',
        thesis: 'Saved sessions keep the original reasoning visible, so resuming does not mean reconstructing the story.',
        artifacts: [
          ['mode', 'saved session'],
          ['source', 'original reasoning intact'],
          ['story', 'project narrative ready'],
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
    },
    nav: {
      demo: '演示',
      moments: '时刻',
      problem: '问题',
      capabilities: '能力',
      cbti: 'CBTI',
      lifecycle: '生命周期',
      contribute: 'contribute',
    },
    hero: {
      title: '让 Claude Code 长会话，\n有清晰脉络。',
      lede:
        'GUI-Anything 伴随 Claude Code 运行，将会话中的意图、进展与可复用经验整理成清晰脉络。',
      ctaPrimary: '查看 GitHub',
      proofLabel: '留下清楚的东西',
      proof: ['意图一直可见', '工作变成时间线', '项目故事被保留', '经验变成记忆'],
    },
    demo: {
      tag: '演示',
      title: '实时呈现意图、过程和知识。',
      hint: '长时间编码会话，在发生时就变得可读。',
      body: '对话继续向前，右栏留下清楚的过程。',
      callouts: {
        flow: [
          { target: 'intent', label: '每一步都有意图' },
          { target: 'knowledge', label: '相关记忆及时出现' },
          { target: 'running', label: '当前工作容易定位' },
        ],
        timeline: [
          { target: 'focus', label: '当前焦点' },
          { target: 'tree', label: '工作地图' },
        ],
        workspace: [
          { target: 'workspace', label: '项目结构' },
          { target: 'trace', label: '近期活动' },
        ],
        note: [
          { target: 'notes', label: '会话笔记' },
        ],
        knowledge: [
          { target: 'knowledge', label: '相关历史上下文' },
          { target: 'wiki', label: '有用经验已保存' },
        ],
        replay: [
          { target: 'replay', label: '保存下来的会话故事' },
          { target: 'bundle', label: '原始推理被保留' },
          { target: 'html', label: '项目叙事可分享' },
        ],
      },
    },
    moments: {
      title: '跳到某个产品时刻',
      body: '每张卡片展示一种让会话更容易理解的方式。',
      items: [
        {
          id: 'timeline',
          scenarioId: 'flow',
          title: '实时时间线',
          text: '意图标签、摘要，底部钉住进行中的卡片。',
        },
        {
          id: 'knowledge',
          scenarioId: 'knowledge',
          title: 'KNOWLEDGE 命中',
          text: 'Claude 还在跑时，相关历史上下文已经出现在卡片上。',
        },
        {
          id: 'flowchart',
          scenarioId: 'timeline',
          title: '流程图焦点',
          text: '转向和当前分支变成一张可读的工作地图。',
        },
        {
          id: 'workspace',
          scenarioId: 'workspace',
          title: 'Workspace 视图',
          text: '项目结构和近期活动跟会话放在一起。',
        },
        {
          id: 'replay',
          scenarioId: 'replay',
          title: 'Strict replay',
          text: '保存过的会话可以带着原始推理重新回看。',
        },
        {
          id: 'notes',
          scenarioId: 'note',
          title: '会话笔记',
          text: '随手观察会贴在同一轮工作旁边。',
        },
      ],
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
      body: 'GUI-Anything 用意图、时间线、通知和可复用记忆承载核心会话表面，让交互过程可以回看、继续和复用。',
      items: [
        {
          id: 'flow',
          title: '心流',
          text: '每一步工作生成一张总结卡片：意图、转向和当前状态一眼可见。',
          preview: {
            kind: 'flow',
            label: '会话视图',
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
          text: '有用经验沉淀成项目记忆。会话继续跑，知识也跟着长出来。',
          preview: {
            kind: 'wiki',
            root: '项目记忆',
            status: '已保存洞察',
            treeLabel: '项目记忆',
            items: [
              { type: 'folder', name: '决策', depth: 0 },
              { type: 'file', name: '调试经验', depth: 1, active: true },
              { type: 'folder', name: '会话', depth: 0 },
              { type: 'file', name: '可读回顾', depth: 1 },
            ],
            fileTitle: '# 调试经验',
            excerpt: '留下原因、修法和下次什么时候能复用。项目记忆会在会话里慢慢长出来。',
            path: '可复用项目记忆',
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
          scene: ['claude · 运行中', '右栏 · 3 张卡片 · live'],
        },
        {
          id: 'after',
          title: '之后',
          text: '关键经验变成可复用记忆，会话可以回看，也能生成项目故事。',
          scene: ['项目记忆', '已保存会话', '可分享故事'],
        },
        {
          id: 'next',
          title: '下次',
          text: '从保存的脉络接着做。',
          scene: ['带着上下文继续', '推理脉络仍在'],
        },
        {
          id: 'sidecar',
          title: '分享',
          text: '工作过程可以变成给队友或未来自己的项目叙事。',
          scene: ['项目故事', '演进时间线'],
        },
      ],
    },
    cbti: {
      tag: 'CBTI',
      title: 'CBTI：Claude MBTI 会话人格。',
      body: '通过对话分析会话人格，生成你的 CBTI 档案。',
      galleryLabel: 'CBTI Claude MBTI 人格图库',
      items: CBTI_ITEMS,
    },
    principles: {
      tag: '原则',
      items: [
        { title: '原生 Claude，可见过程', text: 'Claude Code 保持原样，GUI-Anything 让会话更容易跟上。' },
        { title: '只保存值得复用的经验', text: '转向、判断和可复用做法，会慢慢变成项目记忆。' },
        { title: '本地优先', text: '时间线、地图和记忆都跟着你的项目走。' },
      ],
    },
    contribute: {
      tag: 'contribute',
      title: 'Contribute code.',
      body: 'Pick up an issue, send a PR, or improve the product experience.',
      github: 'Issues',
      guide: 'Contributor guide',
    },
    footer: {
      line: 'MIT · 本地优先 · 让编码会话更可读',
      top: '回到顶部',
      readme: 'GitHub README',
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
        thesis: 'Claude 在跑。GUI-Anything 会随着工作展开，逐步生成可读时间线。',
        artifacts: [
          ['状态', 'live · 等待工作展开'],
          ['形状', '上下文变多，时间线出现'],
          ['下一步', '第一张工作卡片出现'],
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
        thesis: 'Timeline 把一段工作拉到前台，用标题和高亮帮助快速定位。',
        artifacts: [
          ['地图', '流程图和时间线保持连接'],
          ['焦点', '当前工作在节点轨高亮'],
          ['安静', '旧工作不会挡住当前判断'],
        ],
      },
      workspace: {
        title: '项目结构就在会话旁边。',
        thesis: 'Workspace mode 展示这轮会话真正相关的项目区域。',
        artifacts: [
          ['结构', '项目区域保持在视野里'],
          ['活跃', '当前工作被清楚标记'],
          ['近期', '活动被整理成摘要'],
        ],
      },
      note: {
        title: '随手记，不离开双栏。',
        thesis: '临时想法留在工作旁边，判断和备注不会散掉。',
        artifacts: [
          ['笔记', '旁路想法贴在会话上'],
          ['输入', '一个想法一条笔记'],
          ['上下文', '对话和笔记保持在一起'],
        ],
      },
      knowledge: {
        title: '跑着也能命中过去的记忆。',
        thesis: '相关经验会在它能帮上当前工作时出现。',
        artifacts: [
          ['命中', '找到相关经验'],
          ['保存', '有用知识被留下'],
          ['复用', '过去判断成为当前上下文'],
        ],
      },
      replay: {
        title: '诚实的续跑。',
        thesis: '保存过的会话会保留原始推理，继续做时不用重新拼故事。',
        artifacts: [
          ['模式', '已保存会话'],
          ['来源', '原始推理仍在'],
          ['故事', '项目叙事可分享'],
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
