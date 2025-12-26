# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: Sign in
        - generic [ref=e6]: Enter your email and password to access your account
      - generic [ref=e7]:
        - form "Sign in" [ref=e8]:
          - generic [ref=e9]:
            - text: Email
            - textbox "Email" [ref=e10]:
              - /placeholder: Enter your email
              - text: test@docfiscal.com
          - generic [ref=e11]:
            - text: Password
            - textbox "Password" [ref=e12]:
              - /placeholder: Enter your password
              - text: testpassword123
          - alert [ref=e13]:
            - generic [ref=e14]:
              - generic [ref=e15]:
                - img [ref=e16]
                - generic [ref=e18]: Login successful! Redirecting to dashboard...
              - button "Dismiss success message" [ref=e19] [cursor=pointer]:
                - img [ref=e20]
          - button "Sign in" [ref=e22] [cursor=pointer]
        - generic [ref=e23]:
          - text: Don't have an account?
          - link "Sign up" [ref=e24] [cursor=pointer]:
            - /url: /register
  - generic [ref=e25]:
    - img [ref=e27]
    - button "Open Tanstack query devtools" [ref=e76] [cursor=pointer]:
      - img [ref=e77]
  - alert [ref=e126]
```