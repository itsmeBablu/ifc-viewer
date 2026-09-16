import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth } = NextAuth({
  // Match the route handler even when AUTH_URL contains a workspace path.
  basePath: "/api/auth",
  // Trust the Host header on Vercel so callback URLs resolve correctly in production.
  trustHost: true,
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      if (account?.provider === "google") token.googleId = account.providerAccountId;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.googleId === "string") session.user.id = token.googleId;
      return session;
    },
  },
});
