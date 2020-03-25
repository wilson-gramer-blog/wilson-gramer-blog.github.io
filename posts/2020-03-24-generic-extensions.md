---
title: “Generic extensions”?
postDate: March 24, 2020
---

Currently in Swift the `zip` function is implemented similar to this:

```swift
// The actual signature/implementation is different than this for performance
// reasons, but the end functionality is the same
func zip<Element>(_ array1: [Element], array2: [Element]) -> [(Element, Element)]
```

To make this more "Swifty", we could make it an array initializer:

```swift
extension Array where Element == (Element, Element) {
    init(zipping array1: [Element], with array2: [Element])
}
```

...but wait, now we have two definitions of `Element`, with one defined in terms of other. That's a problem, because we can't conform `Element` to two different types at the same time, and we certainly can't have it be defined recursively!

To solve this problem, we need to be able to define **"generic extensions"** — I'm not really sure what that would look like or how it would work, but to my knowledge it currently isn't possible in Swift. That's why `zip` must be a global function — it must know the type of `Element` beforehand (via its generic argument) in order to evaluate the return type. When we're defining extensions for existing types, that logic is kind of backwards.

I'm curious as to how this could be written. Maybe something like this?

```swift
extension<ZippingElement> Array where Element == (ZippingElement, ZippingElement) {
    init(zipping array1: [ZippingElement], with array2: [ZippingElement])
}
```

I also wonder if other languages have the concept of "generic extensions" or anything similar. I'll do some research!
