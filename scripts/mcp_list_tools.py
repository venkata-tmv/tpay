import asyncio

from mcp import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters


async def main():
    server = StdioServerParameters(
        command="/Users/likith/Documents/tpay/.venv/bin/python",
        args=["-m", "app.mcp_servicetitan_read_server"],
        cwd="/Users/mkowt/Code/tpay",
        env=None,  # inherits your environment; cwd points to .env location
    )

    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("TOOLS:", [t.name for t in tools.tools])


if __name__ == "__main__":
    asyncio.run(main())