# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests",
#     "beautifulsoup4",
#     "deep-translator",
# ]
# ///

import os
import json
import argparse
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime
from deep_translator import GoogleTranslator

# GraphQL Endpoint
GRAPHQL_URL = "https://learngerman.dw.com/graphql"

def find_article_info(target_date_str):
    """
    Query DW GraphQL API for the list of articles and find the one for the target date.
    Returns (article_id, article_url)
    """
    dt = datetime.strptime(target_date_str, "%Y-%m-%d")
    german_date = dt.strftime("%d.%m.%Y")
    
    # NavigationPage query for "Kurz und leicht" (ID 69137519)
    payload = {
        "operationName": "NavigationPage",
        "variables": {"id": 69137519, "lang": "GERMAN", "appName": "mdl"},
        "extensions": {
            "persistedQuery": {
                "version": 1,
                "sha256Hash": "3bccea8245c77674dae89b7effc401b1173aecc7c853e45af0398639d7f95aca"
            }
        }
    }
    
    print(f"Fetching article list from DW API for {german_date}...")
    headers = {"Content-Type": "application/json"}
    response = requests.post(GRAPHQL_URL, json=payload, headers=headers)
    if response.status_code != 200:
        print(f"API Error: {response.status_code} - {response.text}")
        return None, None
        
    data = response.json()
    try:
        spaces = data["data"]["content"]["contentComposition"]["informationSpaces"]
        for space in spaces:
            for component in space["compositionComponents"]:
                if component.get("type") == "LG_FORMAT" and "contents" in component:
                    for item in component["contents"]:
                        name = item.get("name", "")
                        if german_date in name:
                            return item["id"], "https://learngerman.dw.com" + item["namedUrl"]
    except (KeyError, TypeError) as e:
        print(f"Error parsing API response: {e}")
        
    return None, None

def extract_id_from_url(url):
    """Extract the numeric article ID from a DW URL (e.g., .../a-76653730)"""
    match = re.search(r"/a-(\d+)", url)
    if match:
        return match.group(1)
    return None

def extract_date_from_url(url):
    """
    Parse the date from a DW article URL slug.
    The slug format is DDMMYYYY, e.g.:
      /de/12032026-kurz-und-leicht-... -> 2026-03-12
    Returns a YYYY-MM-DD string, or None if not found.
    """
    match = re.search(r"/de/(\d{2})(\d{2})(\d{4})-", url)
    if match:
        day, month, year = match.group(1), match.group(2), match.group(3)
        return f"{year}-{month}-{day}"
    return None

def extract_article_data(article_id):
    """
    Query DW GraphQL API for article content and extract multiple sub-articles with their text and vocab.
    """
    payload = {
        "operationName": "ContentPage",
        "variables": {"id": int(article_id), "lang": "GERMAN", "appName": "mdl"},
        "extensions": {
            "persistedQuery": {
                "version": 1,
                "sha256Hash": "4cc3b5f1ab3c69812cb6a6bc7a16fd7f4463e8e67358f8feb4653d97052571ea"
            }
        }
    }
    
    print(f"Fetching article content for ID {article_id}...")
    headers = {"Content-Type": "application/json"}
    response = requests.post(GRAPHQL_URL, json=payload, headers=headers)
    if response.status_code != 200:
        return []

    data = response.json()
    html_content = data.get("data", {}).get("content", {}).get("text", "")
    if not html_content:
        return []

    soup = BeautifulSoup(html_content, "html.parser")
    articles = []
    current_article = None

    # Flatten the search to find all relevant tags (h2 for title, p/li for text/vocab)
    for tag in soup.find_all(["h2", "p", "li"]):
        if tag.name == "h2":
            if current_article:
                articles.append(current_article)
            current_article = {
                "title": tag.get_text().strip(),
                "text": "",
                "vocab": []
            }
        elif current_article:
            # Replace <br> tags with a marker to split by
            for br in tag.find_all('br'):
                br.replace_with("\n")
            
            raw_text = tag.get_text().strip()
            if not raw_text:
                continue

            lines = raw_text.split("\n")
            
            for line in lines:
                line = line.strip()
                if not line: continue
                
                # DW standard vocab format: "Word – Explanation"
                matched_delim = None
                for delim in [" \u2013 ", " - "]:
                    if delim in line:
                        matched_delim = delim
                        break
                
                if matched_delim:
                    parts = line.split(matched_delim, 1)
                    word_candidate = parts[0].strip()
                    explanation_candidate = parts[1].strip()
                    # Heuristic for word part length
                    if 0 < len(word_candidate) < 80 and len(explanation_candidate) > 3:
                        current_article["vocab"].append({"german": word_candidate, "explanation": explanation_candidate})
                        continue # Found vocab, move to next line
                
                # If not vocab, and it looks like reporting text (longer line)
                # We filter out common metadata or recurring phrases if needed
                if len(line) > 10 and "kurz und leicht" not in line.lower() and "autor" not in line.lower():
                    current_article["text"] += line + "\n\n"

    if current_article:
        articles.append(current_article)
            
    return articles

def update_manifest(data_dir):
    """
    Scans the data directory for all vocab_*.json files and updates manifest.json.
    """
    days = []
    if not os.path.exists(data_dir):
        return
        
    for filename in os.listdir(data_dir):
        if filename.startswith("vocab_") and filename.endswith(".json"):
            # Extract date from vocab_YYYY-MM-DD.json
            date_part = filename.replace("vocab_", "").replace(".json", "")
            days.append(date_part)
            
    # Sort newest first
    days.sort(reverse=True)
    
    manifest_path = os.path.join(data_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(days, f, indent=2)
    print(f"Updated manifest with {len(days)} dates.")

def main():
    parser = argparse.ArgumentParser(description="Pulls vocabulary for DW Kurz und leicht articles.")
    parser.add_argument("--date", type=str, default=datetime.now().strftime("%Y-%m-%d"),
                        help="Date to scrape in YYYY-MM-DD format. Defaults to today.")
    parser.add_argument("--url", type=str, help="Direct link to the DW article.")
    args = parser.parse_args()
    
    date_str = args.date
    article_id = None
    article_url = None
    
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "data")
    os.makedirs(output_dir, exist_ok=True)

    try:
        if args.url:
            article_url = args.url
            article_id = extract_id_from_url(args.url)
            if not article_id:
                print(f"Error: Could not extract article ID from URL: {args.url}")
                return
            # Auto-parse the date from the URL slug (DDMMYYYY format)
            parsed_date = extract_date_from_url(args.url)
            if parsed_date:
                date_str = parsed_date
                print(f"Using direct URL: {article_url} (ID: {article_id}, Date parsed from URL: {date_str})")
            else:
                print(f"Using direct URL: {article_url} (ID: {article_id}, Date: {date_str})")
        else:
            article_id, article_url = find_article_info(date_str)
            if not article_id:
                print(f"No new article found for {date_str}. (This is normal on weekends or if already up-to-date)")
                return
            print(f"Found Article: {article_url} (ID: {article_id})")

        articles = extract_article_data(article_id)
        if not articles:
            print("Successfully extracted 0 articles.")
            return
            
        print(f"Grouped into {len(articles)} articles.")
        
        # Collect all vocab for bulk translation
        all_vocab_items = []
        for art in articles:
            all_vocab_items.extend(art["vocab"])
        
        if len(all_vocab_items) == 0:
            print("No vocabulary found in article.")
            return

        print(f"Translating {len(all_vocab_items)} German words to English...")
        try:
            words_to_translate = [item["german"] for item in all_vocab_items]
            bulk_text = "\n".join(words_to_translate)
            translator = GoogleTranslator(source='de', target='en')
            bulk_english = translator.translate(bulk_text)
            english_words = bulk_english.split('\n')
            
            for i, item in enumerate(all_vocab_items):
                item["english"] = english_words[i].strip() if i < len(english_words) else ""
                item["id"] = str(i + 1)
        except Exception as e:
            print(f"Warning: Bulk translation failed: {e}")
            
        final_output = {
            "articleDate": date_str,
            "articleLink": article_url,
            "articles": articles
        }
        
        file_path = os.path.join(output_dir, f"vocab_{date_str}.json")
        with open(file_path, "w", encoding="utf-8") as f:
             json.dump(final_output, f, indent=2, ensure_ascii=False)
             
        print(f"Successfully saved {len(all_vocab_items)} items across {len(articles)} articles to {file_path}")
    finally:
        # Always update manifest before exiting
        update_manifest(output_dir)

if __name__ == "__main__":
    main()
