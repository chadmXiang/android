#!/usr/bin/env python3
"""edge-tts 批量合成（微软 Edge 朗读接口，免费、神经网络音色，需要联网）。

输入：stdin 一个 JSON 数组 [{"key": "...", "text": "...", "out": "/abs/path.mp3"}]
输出：stdout 一个 JSON 对象 {key: {"out": path, "marks": [[秒, 累计字数], ...]}}
marks 来自 WordBoundary 事件，用于字幕逐字点亮（比按时间线性插值准）。

用法：python3 scripts/edge_tts_batch.py --voice zh-CN-YunyangNeural --rate +8% < jobs.json
"""
import argparse
import asyncio
import json
import sys

import edge_tts

parser = argparse.ArgumentParser()
parser.add_argument("--voice", default="zh-CN-YunyangNeural")
parser.add_argument("--rate", default="+8%")
parser.add_argument("--volume", default="+0%")
parser.add_argument("--concurrency", type=int, default=8)
parser.add_argument("--timeout", type=float, default=60.0, help="单条合成超时（秒）；流被挂住时靠它解锁")
args = parser.parse_args()

jobs = json.load(sys.stdin)
sem = asyncio.Semaphore(args.concurrency)
done = 0
failed: list[str] = []


async def synth(job: dict) -> dict:
    comm = edge_tts.Communicate(job["text"], args.voice, rate=args.rate, volume=args.volume)
    audio = bytearray()
    marks: list[list[float]] = []
    chars = 0
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
            # offset 单位是 100ns。中文音色只给句边界（WordBoundary 为空），
            # 句级已经够字幕按句点亮，比纯按总时长线性推准得多。
            marks.append([round(chunk["offset"] / 1e7, 3), chars])
            chars += len(chunk["text"])
    if not audio:
        raise RuntimeError("空音频")
    with open(job["out"], "wb") as f:
        f.write(audio)
    # marks 落盘在音频旁边：中途失败重跑时，已成功的那批不用重合成也能拿回句边界
    with open(job["out"] + ".json", "w", encoding="utf-8") as f:
        json.dump(marks, f, ensure_ascii=False)
    return {"out": job["out"], "marks": marks, "chars": chars}


async def one(job: dict) -> tuple[str, dict] | None:
    """合成一条；失败只跳过不中断整批——否则一条挂住就白跑几百条。"""
    global done
    async with sem:
        last_err: Exception | None = None
        for attempt in range(3):  # 服务端偶发 1006 断流 / 不发数据，重试即可
            try:
                out = await asyncio.wait_for(synth(job), timeout=args.timeout)
                done += 1
                print(f"\r合成 {done}/{len(jobs)}", end="", file=sys.stderr, flush=True)
                return job["key"], out
            except (Exception, asyncio.TimeoutError) as err:  # noqa: BLE001 — 网络/协议/超时一律重试
                last_err = err
                await asyncio.sleep(1.5 * (attempt + 1))
        failed.append(job["key"])
        print(f"\n跳过 {job['key']}：{last_err}", file=sys.stderr, flush=True)
        return None


async def main() -> None:
    results = [r for r in await asyncio.gather(*(one(j) for j in jobs)) if r]
    print(f"\n完成 {len(results)}/{len(jobs)}" + (f"，失败 {len(failed)}" if failed else ""), file=sys.stderr)
    json.dump(dict(results), sys.stdout, ensure_ascii=False)


asyncio.run(main())
