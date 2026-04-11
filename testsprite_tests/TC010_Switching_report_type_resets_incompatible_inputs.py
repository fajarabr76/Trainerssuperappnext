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

        # -> Navigate to the login page (/login) and sign in with the provided credentials.
        await page.goto("http://localhost:3000/login")

        # -> Navigate to /qa-analyzer/reports (the Report Maker). If redirected to login, proceed to sign in with the provided credentials and then continue to the reports page.
        await page.goto("http://localhost:3000/qa-analyzer/reports")

        # -> Navigate to /login and sign in with the provided credentials, then continue to /qa-analyzer/reports to test switching between Individual and Service report types.
        await page.goto("http://localhost:3000/login")

        # -> Open the site navigation or modules to reveal the login or navigation links (click the 'Explore Modules' button) so I can find the login form or link.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator("xpath=/html/body/main/div[2]/div/div/div[3]/button").nth(
            0
        )
        await asyncio.sleep(3)
        await elem.click()

        # -> Fill the login form (email then password) and submit, then wait for the app to navigate/finish loading.
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

        # -> Navigate to /qa-analyzer/reports so the app either shows the report maker or redirects to login; then continue with the report-type switching verification.
        await page.goto("http://localhost:3000/qa-analyzer/reports")

        # -> Click the 'Individu' report type button to reveal agent selection inputs.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div/button[2]"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Select an agent from the 'Cari agen' dropdown (choose 'Adhitya Wisnuwadhana (Tim Call)'), then switch to 'Layanan' (Service) and check whether the agent selection was cleared or disabled.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div/button"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # -> Open the Individu report type to confirm the agent selection was cleared (the agent dropdown should show the placeholder “— Pilih agen —” or otherwise indicate no agent selected).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator(
            "xpath=/html/body/div/div[2]/main/div/div/section/div/button[2]"
        ).nth(0)
        await asyncio.sleep(3)
        await elem.click()

        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert (
            await frame.locator("xpath=//*[contains(., '— Pilih agen —')]")
            .nth(0)
            .is_visible()
        ), (
            "The agent selection should be cleared and show the placeholder — Pilih agen — after switching report type."
        )
        assert (
            await frame.locator("xpath=//*[contains(., 'Download')]")
            .nth(0)
            .is_visible()
        ), "The report should be ready and present a Download option after generation."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()


asyncio.run(run_test())
