# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e8]:
        - img [ref=e10]
        - generic [ref=e16]: DocFiscal
      - navigation [ref=e17]:
        - link "Convert" [ref=e18] [cursor=pointer]:
          - /url: /
          - img [ref=e19]
          - generic [ref=e23]: Convert
      - generic [ref=e25]:
        - link "Sign In" [ref=e26] [cursor=pointer]:
          - /url: /login
          - button "Sign In" [ref=e27]
        - link "Sign Up" [ref=e28] [cursor=pointer]:
          - /url: /register
          - button "Sign Up" [ref=e29]
    - generic [ref=e32]:
      - generic [ref=e33]:
        - heading "Order Not Found" [level=1] [ref=e34]
        - paragraph [ref=e35]: The order you're looking for doesn't exist or you don't have permission to view it.
      - generic [ref=e36]:
        - paragraph [ref=e37]: "Possible reasons:"
        - list [ref=e38]:
          - listitem [ref=e39]: The order ID is incorrect or expired
          - listitem [ref=e40]: The order belongs to a different user
          - listitem [ref=e41]: There was an issue during the upload process
          - listitem [ref=e42]: The backend service is temporarily unavailable
      - generic [ref=e43]:
        - button "Back to Home" [ref=e44] [cursor=pointer]:
          - img
          - text: Back to Home
        - button "View All Orders" [ref=e45] [cursor=pointer]
  - alert [ref=e46]
```