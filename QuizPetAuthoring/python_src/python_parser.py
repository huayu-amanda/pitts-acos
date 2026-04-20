#!/usr/bin/env python3
import sys
import json
import ast


def preprocess_code(raw_code: str) -> str:
    """
    预处理代码：
    1. 去掉首尾的三引号（无论是三重双引号还是三重单引号）
    """
    if raw_code is None:
        return ""

    text = raw_code.strip()

    # 如果整个字符串被 """...""" 或 '''...''' 包起来，去掉它们
    if (text.startswith('"""') and text.endswith('"""')) or \
       (text.startswith("'''") and text.endswith("'''")):
        text = text[3:-3]
        # 去掉开头多余的换行
        while text.startswith("\n") or text.startswith("\r\n"):
            text = text[1:]

    return text


def ast_to_concept_tree(code: str, filename: str = "") -> dict:
    """
    把（已经预处理好的、可被 ast.parse 的）Python 源码解析成 ConceptNode 兼容的树根 JSON。
    """
    # 解析 AST，如果代码非法会抛异常，交给上层处理
    tree = ast.parse(code)

    # 根节点
    total_lines = len(code.splitlines()) or 1
    root = {
        "id": None,
        "classFile": filename or "",
        "name": "root",
        "startLine": 1,
        "endLine": total_lines,
        "children": [],
        "weight": "1.0",
        "direction": "outcome",
    }

    # 只收集顶层函数定义为 child 节点
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            func_node = {
                "id": None,
                "classFile": filename or "",
                "name": node.name,
                "startLine": getattr(node, "lineno", None),
                "endLine": getattr(node, "end_lineno", getattr(node, "lineno", None)),
                "children": [],
                "weight": "1.0",
                "direction": "outcome",
            }
            root["children"].append(func_node)

    return root


def main():
    # 从 stdin 读取 Java 传过来的 JSON：{"code": "...", "filename": "..."}
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except Exception as e:
        # 错误日志走 stderr
        print("[PY_ERROR] failed to json.loads stdin:", repr(e), file=sys.stderr, flush=True)
        sys.exit(1)

    code_raw = data.get("code", "")
    filename = data.get("filename", "Tester.py")

    try:
        # 预处理：仅去三引号，不做参数/占位符替换
        preprocessed_code = preprocess_code(code_raw)

        # debug 输出全部走 stderr（不会影响 stdout 的 JSON）
        print("[PY_DEBUG] filename =", filename, file=sys.stderr, flush=True)
        print("[PY_DEBUG] original code =", repr(code_raw[:200]), file=sys.stderr, flush=True)
        print("[PY_DEBUG] preprocessed code =", repr(preprocessed_code[:200]), file=sys.stderr, flush=True)

        # 解析成概念树
        result = ast_to_concept_tree(preprocessed_code, filename=filename)

        # 关键点：stdout 只输出 JSON，不夹杂其它内容
        sys.stdout.write(json.dumps(result))
        sys.stdout.flush()

        sys.exit(0)

    except Exception as e:
        # 异常信息同样只写到 stderr
        print("[PY_ERROR] exception in parser:", repr(e), file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()