#!/usr/bin/env python3
"""
Fetch Wiloo YouTube video transcripts.

Uses:
- yt-dlp (CLI) to list channel videos and get upload dates
- youtube-transcript-api to fetch French auto-generated transcripts

Usage:
  python3 scripts/fetch-wiloo.py                       # default: since 20260523
  python3 scripts/fetch-wiloo.py --since 20260607      # incremental
  python3 scripts/fetch-wiloo.py --since 20260607 --output /tmp/new.json
"""

import argparse
import json
import os
import subprocess
import sys
import time

from youtube_transcript_api import YouTubeTranscriptApi

CHANNEL_URL = "https://www.youtube.com/@Wiloo/videos"
DEFAULT_CUTOFF = "20260523"
DEFAULT_OUTPUT = os.path.join(
    os.path.dirname(__file__), "..", "src", "data", "generated", "wiloo-transcripts.json"
)
MAX_FLAT_PLAYLIST = 30


def run_ytdlp(args: list[str]) -> str:
    result = subprocess.run(
        ["yt-dlp", *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  yt-dlp error: {result.stderr.strip()}", file=sys.stderr)
    return result.stdout.strip()


def list_recent_ids() -> list[tuple[str, str]]:
    """Return (id, title) pairs from the channel, most recent first."""
    print(f"Listing videos from {CHANNEL_URL} ...")
    raw = run_ytdlp([
        "--flat-playlist",
        "--print", "%(id)s\t%(title)s",
        CHANNEL_URL,
    ])
    entries = []
    for line in raw.splitlines()[:MAX_FLAT_PLAYLIST]:
        parts = line.split("\t", 1)
        if len(parts) == 2:
            entries.append((parts[0], parts[1]))
    print(f"  Got {len(entries)} recent video IDs")
    return entries


def get_upload_date(video_id: str) -> str | None:
    """Return upload date as YYYYMMDD string, or None on failure."""
    raw = run_ytdlp([
        "--skip-download",
        "--print", "%(upload_date)s",
        f"https://www.youtube.com/watch?v={video_id}",
    ])
    date = raw.strip()
    if date and date != "NA":
        return date
    return None


def fetch_transcript(video_id: str) -> str | None:
    """Fetch French transcript text for a video."""
    api = YouTubeTranscriptApi()
    try:
        transcript = api.fetch(video_id, languages=["fr"])
        return " ".join(s.text for s in transcript.snippets)
    except Exception as e:
        print(f"  Transcript error for {video_id}: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description="Fetch Wiloo transcripts")
    parser.add_argument("--since", default=DEFAULT_CUTOFF,
                        help="Only fetch videos uploaded on or after YYYYMMDD (default: 20260523)")
    parser.add_argument("--output", default=DEFAULT_OUTPUT,
                        help="Output JSON file path")
    parser.add_argument("--exclude", nargs="*", default=[],
                        help="Video IDs to skip (already fetched)")
    args = parser.parse_args()

    cutoff = args.since
    output_path = args.output
    exclude_set = set(args.exclude)

    entries = list_recent_ids()

    print(f"\nResolving upload dates (cutoff >= {cutoff}) ...")
    videos_in_scope: list[dict] = []

    for video_id, title in entries:
        if video_id in exclude_set:
            print(f"  {video_id} - already fetched, skipping")
            continue

        date = get_upload_date(video_id)
        if date is None:
            print(f"  {video_id} - could not get date, skipping")
            time.sleep(2)
            continue

        if date < cutoff:
            print(f"  {video_id} - {date} - BEFORE cutoff, stopping")
            break

        print(f"  {video_id} - {date} - {title[:60]}")
        videos_in_scope.append({
            "videoId": video_id,
            "title": title,
            "uploadDate": date,
            "url": f"https://www.youtube.com/watch?v={video_id}",
        })
        time.sleep(2)

    print(f"\n{len(videos_in_scope)} new videos in scope")

    if not videos_in_scope:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump([], f)
        print("No new videos found.")
        return

    print("\nFetching transcripts ...")
    for v in videos_in_scope:
        print(f"  {v['videoId']} - {v['title'][:50]} ...", end=" ", flush=True)
        text = fetch_transcript(v["videoId"])
        if text:
            v["transcript"] = text
            word_count = len(text.split())
            print(f"OK ({word_count} words)")
        else:
            v["transcript"] = ""
            print("FAILED")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(videos_in_scope, f, ensure_ascii=False, indent=2)

    total_words = sum(len(v["transcript"].split()) for v in videos_in_scope)
    print(f"\nDone! Saved {len(videos_in_scope)} videos ({total_words} total words)")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
