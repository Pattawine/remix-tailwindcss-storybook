import {
  Form,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { Button } from './components/ui/button'
import styles from './tailwind.css'
import { cssBundleHref } from '@remix-run/css-bundle'
import type { LinksFunction, LoaderFunctionArgs } from '@vercel/remix'
export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
]

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div id="sidebar">
          <h1 className="bg-blue-300 p-4">Remix Contacts</h1>
          <Button className="text-xl" asChild>
            <a href={'/'}>Return Home</a>
          </Button>
          <div>
            <Form id="search-form" role="search">
              <input
                id="q"
                aria-label="Search contacts"
                placeholder="Search"
                type="search"
                name="q"
              />
              <div id="search-spinner" aria-hidden hidden={true} />
            </Form>
            <Form method="post">
              <button type="submit">New</button>
            </Form>
          </div>
          <nav>
            <ul>
              <li>
                <a href={`/contacts/1`}>Your Name</a>
              </li>
              <li>
                <a href={`/contacts/2`}>Your Friend</a>
              </li>
            </ul>
          </nav>
        </div>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
