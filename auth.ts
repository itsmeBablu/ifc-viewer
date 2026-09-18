import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth } = NextAuth({
  // Match the route handler even when AUTH_URL contains a workspace path.
  basePath: "/api/auth",
  // Trust the Host header on Vercel so callback URLs resolve correctly in production.
  trustHost: true,
  providers: [
    Google,
    Credentials({
      id: "guest",
      name: "Guest Architect",
      credentials: {},
      authorize() {
        return { id: "guest-architect", name: "Guest Architect", email: "guest@vstudio.local" };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account, user }) {
      if (account?.provider === "google") token.googleId = account.providerAccountId;
      else if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (typeof token.googleId === "string") session.user.id = token.googleId;
        else if (typeof token.userId === "string") session.user.id = token.userId;
      }
      return session;
    },
  },
});

