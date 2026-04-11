import asyncio
from playwright import async_api


async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",  # Set the browser window size
                "--disable-dev-shm-usage",  # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",  # Use host-level IPC for better stability
                "--single-process",  # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:3000
        await page.goto("http://localhost:3000")

        # -> Navigate to the login page (/login) so I can sign in with the provided credentials.
        await page.goto("http://localhost:3000/login")

        # -> Fill the email field with fajarabr76@gmail.com, fill the password with f@jarabd10, and submit the login form.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator(
            "xpath=/html/body/main/div[5]/div[2]/div[3]/div[2]/form/div/input"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.fill("fajarabr76@gmail.com")

        frame = context.pages[-1]
        # Input text
        elem = frame.locator(
            "xpath=/html/body/main/div[5]/div[2]/div[3]/div[2]/form/div[2]/input"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.fill("f@jarabd10")

        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/main/div[5]/div[2]/div[3]/div[2]/form/button"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Wait for the login action to complete and then navigate to /qa-analyzer/reports to start the report creation flow.
        await page.goto("http://localhost:3000/qa-analyzer/reports")

        # -> Open the 'Tim / folder (opsional)' dropdown so we can choose a specific team (e.g., 'Tim Whatsapp').
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div[2]/div[2]/select"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Click the 'Generate report' button, wait for the UI to complete processing, and check for a ready/download link or button (a .docx download, 'Download'/'Unduh' button, or a ready state message).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div[5]/button"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert (
            await frame.locator("xpath=//*[contains(., 'Download')]")
            .nth(0)
            .is_visible()
        ), (
            "The generated report should be available for download after generation completes"
        )
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()


asyncio.run(run_test())
