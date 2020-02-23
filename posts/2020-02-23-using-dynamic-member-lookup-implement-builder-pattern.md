---
title: Using dynamic member lookup to implement the builder pattern
postDate: February 23, 2020
---

SwiftUI's syntax is unmistakable in regards to building views — instead of assigning properties to your view, you just apply a modifier that returns another view:

```swift
Text("Hello, world!")
  .bold()
  .foregroundColor(.red)
```

This "style" of writing views is very similar to the builder pattern in other languages. But let's say that you already have a bunch of existing types in your project that you're refactoring to use the builder pattern, or you want to apply the builder pattern to types from other libraries. It would definitely be tedious to create functions for every property in every type. Let's see if we can use Swift's powerful type system to do the leg work for us!

> Note that I'm not advocating for or against using the builder pattern in a specific project — this article is more of an exploration into how to implement it in a generic fashion. With that said, let's get started!

It turns out that Swift actually lets us dynamically access properties on a given type, without having to know anything about that type beforehand, using something called **dynamic member lookup**. All you need to do is add the `@dynamicMemberLookup` attribute to your type, and then you can access any random property of the constraints you choose:

```swift
@dynamicMemberLookup
struct SomeType {
  ...
}

let someValue = SomeType()
someValue.foo // works
someValue.someRandomProperty // works
someValue.asdfghjkl // works
```

Dynamic member lookup is actually just syntax sugar for a special variant of a subscript, and it looks like this:

```swift
@dynamicMemberLookup
struct SomeType {
  subscript(dynamicMember key: String) -> Any {
    ...
  }
}

someValue.foo == someValue[dynamicMember: "foo"]
```

In addition to passing an arbitrary string, you can also constrain both the `dynamicMember:` parameter and the subscript's return value to a specific type. You can even use generics! This will make it a lot easier to implement what we're aiming for, so let's start by creating a generic `Builder` type:

```swift
@dynamicMemberLookup
struct Builder<T> {
  private var value: T
  
  init(_ value: T) {
    self.value = value
  }
}
```

We can use this by calling `Builder(MyType())`. Great! Now let's implement the subscript:

```swift
extension Builder {
  subscript<U>(dynamicMember keyPath: WritableKeyPath<T, U>) -> (U) -> Builder<T> {
    return { self.value[keyPath: keyPath] = $0 }
  }
}
```

Woah! There's a lot going on there, so let's break it down step by step.

The first thing that we need to focus on is the use of **key paths** — if you haven't heard of them before, key paths are a concise way to represent a property on a specific type. You write them as `\MyType.property`, or just `\.property` if `MyType` can be inferred. One good use of key paths is when you're mapping an array:

```swift
let names = ["alice", "bob", "charles"]

names.map { $0.capitalized } // ["Alice", "Bob", "Charles"]
names.map(\.capitalized)
```

Here, a key path is being used to specify that we want to access the `capitalized` property on each string. It's the same as creating a closure that returns the `capitalized` property, but it's a bit more concise. The type of a key path is `KeyPath<T, U>`, where `T` is the type of the value you're accessing the property of, and `U` is the type of the property being accessed.

Back to our example:

```swift
subscript<U>(dynamicMember keyPath: WritableKeyPath<T, U>)
```

So here instead of using a regular key path, we're just using a writable key path — same thing, except we also get to **assign** values to the property being accessed. By constraining the type of `dynamicMember:` to a key path, we only allow users of `Builder` to call functions whose name and type match that of the original value they passed into the `Builder` instance. And we get code completion now, too — neat! 

If that didn't make 100% sense, here's an example in code:

```swift
@dynamicMemberLookup
struct UnconstrainedAccess {
  subscript(dynamicMember key: String) -> Any {
    ...
  }
}

let unconstrained = UnconstrainedAccess()
unconstrained.foo // works
unconstrained.asdfghjkl // works

...

struct Person {
  var name: String
  var age: Int
}

@dynamicMemberLookup
struct ConstrainedAccess {
  subscript<U>(dynamicMember keyPath: KeyPath<Person, U>) -> U {
    // Any arbitrary key path can be accessed using the
    // value[keyPath: ...] subscript. foo[keyPath: \.bar] == foo.bar
    return self.someInstanceOfPerson[keyPath: keyPath]
  }
}

let constrained = ConstrainedAccess(...)
constrained.name // works, is of type String
constrained.age // works, is of type Int
constrained.foo // error!

// Also note that this is all still just syntax sugar:
constrained.name == constrained[dynamicMember: \Person.name]
```

Now let's focus on what our subscript is returning:

```swift
subscript<U>(...) -> (U) -> Builder<T> {
  return { self.value[keyPath: keyPath] = $0 }
}
```

In the previous example with `ConstrainedAccess`, we implemented a dynamic member lookup that just sent back the value of the property accessed by the key path. Here, we're sending back a **function** that can be called with the value we want to assign to the given property of the underlying `self.value`. Then from that function, we return the original `Builder` instance, letting us chain multiple calls together. This gives us our SwiftUI-like syntax:

```swift
Builder(someInstanceOfPerson)
  .name("Alice")
  .age(42)
```

If you've been following along really closely, you may have said "But wait! That resolves to a value of `Builder<Person>`, not `Person`!" You would be correct — for that, we can just define a `build()` function that returns the underlying value:

```swift
extension Builder {
  func build() -> T { self.value }
}
```

So now we can do:

```swift
Builder(someInstanceOfPerson)
  .name("Alice")
  .age(42)
  .build()
```

And we get a `Person` value! There's one more issue, though — we have to pass in an *existing* instance of `Person`, just so its values can be modified once again. Ideally we'd use our builder implementation to "initialize" our value from start to finish. In this case, we can define a `Buildable` protocol that requires an empty initializer, so any properties on the type we want to use must have default values:

```swift
protocol Buildable {
  init()
}
```

And to make our implementation even more concise, we can define a static `builder()` function directly on the `Buildable` protocol:

```swift
extension Buildable {
  static func builder() -> Builder<Self> {
    Builder(Self())
  }
}
```

And now adopting the builder pattern is a breeze!

```swift
struct Person: Buildable {
  // Make sure to provide default values
  var name: String = ""
  var age: Int = 0
}

Person.builder()
  .name("Alice")
  .age(42)
  .build()
```

Here's the entire implementation of `Builder` and `Buildable`:

```swift
@dynamicMemberLookup
struct Builder<T> {
  private var value: T
  
  init(_ value: T) {
    self.value = value
  }
  
  subscript<U>(dynamicMember keyPath: WritableKeyPath<T, U>) -> (U) -> Builder<T> {
    return { self.value[keyPath: keyPath] = $0 }
  }
}

protocol Buildable {
  init()
}

extension Buildable {
  static func builder() -> Builder<Self> {
    Builder(Self())
  }
}
```

One interesting potential use case for this could be, in fact, SwiftUI related — take a look 👀

```swift
self.view.addSubview(
  UIImageView.builder()
    .image(UIImage(named: "..."))
    .contentMode(.scaleAspectFit)
    .tintColor(.red)
    .constraints {
      // implementation of the `constraints` builder
      // method is left as an exercise to the reader :)
    }
    .build()
)
```

I hope you enjoyed this article — I hope to post more like it soon! Thanks for reading!
