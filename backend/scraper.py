import asyncio
import random
import time
from typing import List, Dict, Any
from playwright.async_api import async_playwright

HIGH_FAILURE_CATEGORIES = [
    "pool cleaning", "roofing", "plumbing", "tree service", 
    "landscaping", "hvac", "pest control", "carpet cleaning",
    "painter", "electrician", "locksmith", "handyman"
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0"
]

def calculate_score(lead: Dict[str, Any]) -> int:
    score = 0
    
    # No website: +40
    if not lead.get("website"):
        score += 40
        
    # Zero reviews: +20
    if lead.get("reviews_count") == 0:
        score += 20
    # Fewer than 5 reviews: +10
    elif lead.get("reviews_count", 0) < 5:
        score += 10
        
    # Rating under 3.0: +15
    if lead.get("rating") is not None and lead.get("rating") < 3.0:
        score += 15
        
    # Category high failure rate: +15
    category = lead.get("category", "").lower()
    if any(fail_cat in category for fail_cat in HIGH_FAILURE_CATEGORIES):
        score += 15
        
    return score

async def scrape_google_maps(niche: str, location: str, limit: int = 50) -> List[Dict[str, Any]]:
    search_query = f"{niche} in {location}"
    url = f"https://www.google.com/maps/search/{search_query.replace(' ', '+')}"
    
    leads = []
    seen = set() # (name, address)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS)
        )
        page = await context.new_page()
        
        print(f"Searching for: {search_query}")
        await page.goto(url)
        
        # Handle cookie consent if it appears
        try:
            consent_btn = await page.query_selector('button[aria-label="Accept all"]')
            if consent_btn:
                await consent_btn.click()
                await asyncio.sleep(1)
        except:
            pass

        # Wait for the results to load
        try:
            await page.wait_for_selector('div[role="feed"]', timeout=10000)
        except:
            # Maybe it's a direct result or different layout
            pass

        # Scroll loop
        results_count = 0
        scroll_attempts = 0
        max_scroll_attempts = 30 
        
        while results_count < limit and scroll_attempts < max_scroll_attempts:
            # Find the scrollable container
            scrollable_div = await page.query_selector('div[role="feed"]')
            if not scrollable_div:
                # Fallback: maybe just scroll the page
                await page.mouse.wheel(0, 2000)
            else:
                # Scroll the div
                await page.evaluate('(div) => div.scrollBy(0, 1500)', scrollable_div)
            
            await asyncio.sleep(random.uniform(1.0, 2.0))
            
            # Count current results
            current_elements = await page.query_selector_all('a.hfpxzc')
            results_count = len(current_elements)
            print(f"Loaded {results_count} potential leads...")
            
            # Check if we hit the end of the list
            end_of_list = await page.query_selector('text="You\'ve reached the end of the list."')
            if end_of_list:
                break
                
            scroll_attempts += 1

        # Extract data from loaded elements
        # 'div.Nv2Y8b' or 'div.m6736e' or 'div[role="article"]'
        elements = await page.query_selector_all('div[role="article"]')
        if not elements:
            elements = await page.query_selector_all('div.Nv2Y8b')

        print(f"Scraping up to {len(elements)} elements...")

        for i, el in enumerate(elements):
            try:
                # Name
                name_el = await el.query_selector('div.qBF1Pd')
                name = await name_el.inner_text() if name_el else "Unknown"
                
                # Check for website
                website_el = await el.query_selector('a[aria-label*="website"]')
                website = await website_el.get_attribute("href") if website_el else None
                
                # Check for phone number
                phone_el = await el.query_selector('button[aria-label*="Call"]')
                phone = None
                if phone_el:
                    phone_label = await phone_el.get_attribute("aria-label")
                    # Label is usually "Call Business Name: +1 234-567-8901"
                    if ":" in phone_label:
                        phone = phone_label.split(":")[-1].strip()
                
                # Filter: ONLY return businesses WITHOUT a website
                if website:
                    continue
                
                # Rating and reviews
                rating_el = await el.query_selector('span.MW4etd')
                rating = float((await rating_el.inner_text()).replace(',', '.')) if rating_el else None
                
                reviews_el = await el.query_selector('span.UY7F9b')
                reviews_text = await reviews_el.inner_text() if reviews_el else ""
                reviews_count = 0
                if reviews_text:
                    # Extracts numbers from "(123)"
                    digits = ''.join(filter(str.isdigit, reviews_text))
                    if digits:
                        reviews_count = int(digits)
                
                # Category and Address
                # Line structure can vary. Let's look for specific divs.
                # div.W4E7P contains lines of info
                info_lines = await el.query_selector_all('div.W4E7P')
                category = ""
                address = ""
                
                all_text = await el.inner_text()
                lines = [l.strip() for l in all_text.split('\n') if l.strip()]
                
                # Usually:
                # 0: Name
                # 1: Rating (optional)
                # 2: Category
                # 3: Address or Status
                
                # Attempt to find Category (often contains '·' if rating is present, or just the word)
                # Let's use the info_lines if available
                if len(info_lines) > 0:
                    line0 = await info_lines[0].inner_text()
                    if "·" in line0:
                        parts = line0.split("·")
                        # Usually line0 is "Rating (Reviews) · Category"
                        # But it could also be "Category · Address" if rating is missing
                        # If the last part has digits, it might be address.
                        last_part = parts[-1].strip()
                        if any(char.isdigit() for char in last_part):
                            category = parts[0].strip()
                        else:
                            category = last_part
                    else:
                        category = line0.strip()
                
                # Attempt to find Address
                # Address often looks like "Street, City, State Zip" or just "Street"
                # It's usually one of the lines that doesn't look like status or category
                for line in lines[1:]:
                    if any(char.isdigit() for char in line) and (',' in line or len(line.split()) > 2):
                        if not any(status in line.lower() for status in ['open', 'closed', 'opens', 'closes']):
                           address = line
                           break
                
                # Clean address if it still has category
                if '·' in address:
                    address = address.split('·')[-1].strip()

                # Deduplication
                key = (name.lower().strip(), address.lower().strip())
                if key in seen:
                    continue
                seen.add(key)
                
                lead = {
                    "name": name,
                    "phone": phone,
                    "address": address,
                    "category": category,
                    "rating": rating,
                    "reviews_count": reviews_count,
                    "website": None,
                    "closing_score": 0
                }
                
                lead["closing_score"] = calculate_score(lead)
                leads.append(lead)
                
                if len(leads) >= limit:
                    break
                    
            except Exception as e:
                # print(f"Error scraping element {i}: {e}")
                continue

        await browser.close()
    
    return leads
