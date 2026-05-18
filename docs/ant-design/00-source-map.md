# Source Map

This file defines where Ant Design guidance must come from and how an AI agent
should prioritize sources.

## Source Priority

1. Local project rules in `docs/ant-design/`.
2. Official Ant Design Design docs under `https://ant.design/docs/spec/`.
3. Official Ant Design React docs under `https://ant.design/docs/react/`.
4. Official Ant Design component docs under `https://ant.design/components/`.
5. AntD MCP tools exposed by `antd mcp`.
6. GitHub source in `https://github.com/ant-design/ant-design` when official
   website docs or package behavior need confirmation.

Avoid using random blog posts as primary guidance. Third-party articles can be
used only as supporting examples.

## Official Design Menu Map

The Ant Design `Design` section is organized as follows:

- Ant Design
  - Introduction
  - Design Values
  - Cases
- Global Styles
  - Colors
  - Layout
  - Font
  - Icons
  - Dark Mode
  - Shadow
- Design Patterns
  - Overview
  - Global Rules
    - Feedback
    - Navigation
    - Data Entry
    - Data Display
    - Copywriting
    - Data format
    - Button
    - Data List
  - Principles
    - Proximity
    - Alignment
    - Contrast
    - Repetition
    - Make it Direct
    - Stay on the Page
    - Keep it Lightweight
    - Provide an Invitation
    - Use Transition
    - React Immediately
  - Template Document
    - Visualization Page
    - Detail Page
- Design Patterns (Research)
  - Overview
  - Template Document
    - Form Page
    - Workbench
    - List Page
    - Result Page
    - Exception Page
  - Global Rules
    - Navigation
    - Message and Feedback
    - Empty Status
- Standalone
  - Visualization
  - Motion
  - Illustrations

## AI-Oriented Official Sources

- `https://ant.design/llms.txt`
  - Navigation file for AI tools.
- `https://ant.design/llms-full.txt`
  - Full English component documentation with implementation details.
- `https://ant.design/llms-semantic.md`
  - Semantic component descriptions, DOM structure, and usage patterns.
- `https://ant.design/docs/react/llms`
  - Official explanation of Ant Design LLM resources.
- `https://ant.design/docs/react/mcp`
  - Official MCP setup and tool list.
- `https://ant.design/docs/react/customize-theme`
  - Official token and `ConfigProvider` theming guidance.

## MCP Usage

When the AntD MCP server is available, use it for component-level uncertainty:

- `antd_list`: find available components.
- `antd_info`: inspect component props and API.
- `antd_doc`: read component documentation.
- `antd_demo`: inspect runnable examples.
- `antd_token`: inspect design token values.
- `antd_semantic`: inspect DOM parts and styling hooks.
- `antd_changelog`: check API changes.

MCP is not a replacement for Design spec reading. MCP is best for component
implementation detail.

## npm Package Limitation

The installed `antd` npm package is mainly runtime distribution content:

- `dist`
- `es`
- `lib`
- `locale`

It does not include the full website design docs such as `docs/spec`. Therefore,
AI design-system guidance must be stored locally or read from the official
website/GitHub.

