import asyncio
import re
import random
from typing import Optional, List
from playwright.async_api import async_playwright

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]

EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'

async def find_social_links(page, name: str, address: str) -> List[str]:
    """Search Google for social media links of a business."""
    search_query = f'"{name}" {address} facebook instagram'
    url = f"https://www.google.com/search?q={search_query.replace(' ', '+')}"
    
    await page.goto(url)
    
    links = []
    # Extract links that look like Facebook or Instagram
    hrefs = await page.eval_on_selector_all('a', '(links) => links.map(a => a.href)')
    
    for href in hrefs:
        if "facebook.com" in href and "/sharer/" not in href and "/groups/" not in href:
            # Clean up URL (remove parameters)
            clean_url = href.split('?')[0].rstrip('/')
            if clean_url not in links:
                links.append(clean_url)
        if "instagram.com" in href and "/p/" not in href and "/reels/" not in href:
            clean_url = href.split('?')[0].rstrip('/')
            if clean_url not in links:
                links.append(clean_url)
                
    return links[:3] # Return top 3 social links

async def scrape_email_from_page(page, url: str) -> Optional[str]:
    """Visit a page and search for an email address."""
    try:
        await page.goto(url, timeout=30000)
        # Wait a bit for dynamic content
        await asyncio.sleep(2)
        
        content = await page.content()
        emails = re.findall(EMAIL_REGEX, content)
        
        # Filter out common false positives
        filtered_emails = [e for e in emails if not e.endswith(('.png', '.jpg', '.jpeg', '.gif', 'sentry.io', 'example.com'))]
        
        if filtered_emails:
            return filtered_emails[0]
            
        # For Facebook, emails are often in the 'About' section or 'Intro'
        # Playwright can try to look for specific text
        if "facebook.com" in url:
            about_text = await page.evaluate("() => document.body.innerText")
            fb_emails = re.findall(EMAIL_REGEX, about_text)
            if fb_emails:
                return fb_emails[0]
                
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        
    return None

async def find_business_email(name: str, address: str) -> Optional[str]:
    """Orchestrates finding an email for a business."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
        page = await context.new_page()
        
        social_links = await find_social_links(page, name, address)
        print(f"Found social links for {name}: {social_links}")
        
        for link in social_links:
            email = await scrape_email_from_page(page, link)
            if email:
                await browser.close()
                return email
                
        await browser.close()
    return None

if __name__ == "__main__":
    # Test
    async def test():
        email = await find_business_email("Bill's Handyman", "Cape Coral, FL")
        print(f"Found email: {email}")
    
    asyncio.run(test())
