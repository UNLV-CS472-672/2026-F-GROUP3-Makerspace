// Use this to create a new user and login with that user
// Examples:
//   npx tsx ./cypress/support/create-user.ts username@example.com
//   npx tsx ./cypress/support/create-user.ts admin@unlv.nevada.edu admin
//
// This creates a session cookie for the new user so Cypress can set it.

import { installGlobals } from "@remix-run/node";
import { parse } from "cookie";

import { prisma } from "~/db.server";
import { createUserSession } from "~/session.server";

installGlobals();

async function createAndLogin(email: string, role = "staff") {
  if (!email) {
    throw new Error("email required for login");
  }

  if (!email.endsWith("@example.com") && !email.endsWith("@unlv.nevada.edu")) {
    throw new Error("All test emails must end in @example.com or @unlv.nevada.edu");
  }

  const password = "myreallystrongpassword";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      roles: role,
    },
    create: {
      email,
      roles: role,
      password: {
        create: { // Hash the password
          hash: await import("bcryptjs").then(({ default: bcrypt }) =>
            bcrypt.hash(password, 10),
          ),
        },
      },
    },
  });

  const response = await createUserSession({
    request: new Request("test://test"),
    userId: user.id,
    remember: false,
    redirectTo: "/",
  });

  const cookieValue = response.headers.get("Set-Cookie");
  if (!cookieValue) {
    throw new Error("Cookie missing from createUserSession response");
  }

  const parsedCookie = parse(cookieValue);

  console.log(
    `
<cookie>
  ${parsedCookie.__session}
</cookie>
    `.trim(),
  );
}

createAndLogin(process.argv[2], process.argv[3] ?? "staff");