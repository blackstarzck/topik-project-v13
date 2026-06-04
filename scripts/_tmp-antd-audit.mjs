// Comprehensive AST audit: find ALL antd deprecated-prop usages in user-facing
// (non-admin) source, using the @deprecated prop inventory extracted from the
// installed antd 6.4.3 typings (more complete than `antd lint --only deprecated`).
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

// tag -> deprecated JSX attribute names (attribute-style only; sub-component &
// children-API deprecations handled separately).
const DEP = {
  Alert: ["afterClose", "closeText", "message", "onClose"],
  AutoComplete: ["dataSource", "dropdownClassName", "dropdownMatchSelectWidth", "dropdownRender", "dropdownStyle", "onDropdownVisibleChange", "popupClassName"],
  Button: ["iconPosition"],
  Calendar: ["dateCellRender", "dateFullCellRender", "monthCellRender", "monthFullCellRender"],
  Card: ["bodyStyle", "bordered", "headStyle", "tab"],
  Carousel: ["dotPosition"],
  Cascader: ["bordered", "dropdownClassName", "dropdownMatchSelectWidth", "dropdownRender", "dropdownStyle", "onDropdownVisibleChange", "onPopupVisibleChange", "popupClassName", "showArrow"],
  Collapse: ["destroyInactivePanel", "expandIconPosition"],
  Descriptions: ["contentStyle", "labelStyle"],
  Divider: ["orientationMargin"],
  Drawer: ["bodyStyle", "contentWrapperStyle", "destroyOnClose", "drawerStyle", "footerStyle", "headerStyle", "maskClosable", "maskStyle", "width"],
  Dropdown: ["destroyPopupOnHide", "overlayClassName", "overlayStyle"],
  Empty: ["imageStyle"],
  Image: ["destroyOnClose", "maskClassName", "onVisibleChange", "rootClassName", "toolbarRender", "visible", "wrapperStyle"],
  Input: ["bordered", "addonAfter", "addonBefore"],
  InputNumber: ["bordered"],
  Modal: ["autoFocusButton", "bodyStyle", "destroyOnClose", "focusTriggerAfterClose", "maskClosable", "maskStyle"],
  Pagination: ["selectComponentClass"],
  Progress: ["gapPosition", "trailColor"],
  Select: ["bordered", "dropdownClassName", "dropdownMatchSelectWidth", "dropdownRender", "dropdownStyle", "onDropdownVisibleChange", "popupClassName", "showArrow"],
  Slider: ["handleStyle", "onAfterChange", "railStyle", "trackStyle"],
  Space: ["direction", "split"],
  Spin: ["mask", "tip", "wrapperClassName"],
  Statistic: ["valueStyle"],
  Steps: ["direction", "labelPlacement", "progressDot"],
  Tabs: ["destroyInactiveTabPane", "indicatorSize", "popupClassName", "tabPosition"],
  Tag: ["bordered"],
  TimePicker: ["popupClassName", "popupStyle"],
  Timeline: ["pending", "pendingDot"],
  Tooltip: ["destroyTooltipOnHide", "overlayClassName", "overlayInnerStyle", "overlayStyle"],
  Transfer: ["listStyle", "operationStyle", "operations"],
  TreeSelect: ["bordered", "dropdownClassName", "dropdownMatchSelectWidth", "dropdownRender", "dropdownStyle", "onDropdownVisibleChange", "popupClassName", "showArrow"],
  Table: ["filterCheckall", "filterDropdownOpen", "onFilterDropdownOpenChange", "onSelectAll", "onSelectInvert", "onSelectMultiple", "onSelectNone", "sortColumn", "sortOrder"],
  ConfigProvider: ["autoInsertSpaceInButton", "dropdownMatchSelectWidth"],
  // Project wrappers that spread {...props} into the antd component (props reach antd at runtime).
  AppModal: ["autoFocusButton", "bodyStyle", "destroyOnClose", "focusTriggerAfterClose", "maskClosable", "maskStyle"],
  AppDrawer: ["bodyStyle", "contentWrapperStyle", "destroyOnClose", "drawerStyle", "footerStyle", "headerStyle", "maskClosable", "maskStyle", "width"],
  AppCard: ["bodyStyle", "bordered", "headStyle", "tab"],
};

function baseTag(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    let e = node.expression;
    while (ts.isPropertyAccessExpression(e)) e = e.expression;
    return ts.isIdentifier(e) ? e.text : null;
  }
  return null;
}

// collect all .tsx under src excluding admin
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (p.replace(/\\/g, "/").includes("/admin")) continue;
      walk(p);
    } else if (e.name.endsWith(".tsx")) files.push(p);
  }
})("src");

const findings = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = baseTag(node.tagName);
      const deps = tag && DEP[tag];
      if (deps) {
        for (const a of node.attributes.properties) {
          if (ts.isJsxAttribute(a) && a.name && ts.isIdentifier(a.name) && deps.includes(a.name.text)) {
            const { line } = sf.getLineAndCharacterOfPosition(a.name.getStart(sf));
            findings.push({ file: file.replace(/\\/g, "/"), line: line + 1, tag, prop: a.name.text });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

const byKind = {};
for (const f of findings) byKind[`${f.tag}.${f.prop}`] = (byKind[`${f.tag}.${f.prop}`] || 0) + 1;
console.log(`Scanned ${files.length} non-admin .tsx files.`);
console.log(`\n=== DEPRECATED-PROP FINDINGS (AST, full inventory) — ${findings.length} total ===`);
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(3), k);
console.log("\n=== detail ===");
for (const f of findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line))
  console.log(`  ${f.tag}.${f.prop}  ${f.file}:${f.line}`);
fs.writeFileSync("errors/antd-audit-findings.json", JSON.stringify(findings, null, 2));
