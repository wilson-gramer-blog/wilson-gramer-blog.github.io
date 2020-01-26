---
title: Recreating the iOS 12.2 Wallet table view
postDate: February 2, 2019
---

The Wallet app was redesigned in iOS 12.2 with a fresher, more rounded look. This is most prominent in the table views scattered throughout the app — sections are rounded at the edges, similar how a detail table view looks on iPad. It looks really good everywhere, though, so let’s try to recreate it!

(TL;DR: [Here’s the code.](https://gist.github.com/Wilsonator5000/67e1dd18cda7ab46d507a165d6d1bc42))

![The iOS 12.2 Wallet app has a fresher, more rounded look](https://wgramer.files.wordpress.com/2019/02/img_4039.jpg?w=262&h=566)

I’ll be using my app [SuperHomework](http://superhomeworkapp.com/) for this, but of course the code should work on any iOS app. I’m also using the iOS 12.2 beta (it should work on any iOS 12.x release, though) and Swift 4.2, the latest versions at the time of writing. I should also note that part of this implementation was taken from [this answer](https://stackoverflow.com/a/19731571/5569234) and part of [this answer](https://stackoverflow.com/a/48346782/5569234) on Stack Overflow.

Let’s get started! The first thing you’ll notice is how the section insets are increased in the Wallet app. I was experiencing issues setting `UITableView.contentInset` (which you would most likely want to do if you can get it working), so instead I just applied constraints to the left and right edges of the table view using [SnapKit](https://github.com/SnapKit/SnapKit) and set the background color of the main view to that of the table view, giving a seamless look.

```swift 
self.tableView.snp.remakeConstraints { make in
    make.top.bottom.equalToSuperview()
    make.left.right.equalToSuperview().inset(16)
}

self.view.backgroundColor = self.tableView.backgroundColor
```

Next, I created a `UITableView` extension to make the following implementation easier to apply to many different table views.

```swift
extension UITableView {
    func useRoundedSectionCorners() {
        // This will be called in `viewDidLoad()` to set up the table view
    }
    
    func display(withRoundedSectionCorners cell: UITableViewCell, at indexPath: IndexPath) {
        // This will be called in `tableView(_:willDisplay:forRowAt:)` to render each cell
    }
}
```

Inside the `useRoundedSectionCorners` method, I disabled the default separator line that runs through all of the cells and adds a section border — we’ll write our own separator in a bit. I also removed all of the excess padding around the edges of the table view that section headers/footers use to indent themselves.

```swift
func useRoundedSectionCorners() {
    self.separatorStyle = .none
    self.separatorInset = UIEdgeInsets(top: 0, left: self.separatorInset.left, bottom: 0, right: 0)
}
```

Now let’s jump into `display(withRoundedSectionCorners:at:)`. The first thing we need to do is determine which modifications to make on the cell — that is, we don’t want to round the corners of a cell that’s in the middle of a section and whatnot. We can do that by passing the cell’s `indexPath` to the method and doing some math:

```swift 
func display(withRoundedSectionCorners cell: UITableViewCell, at indexPath: IndexPath) {
    // Determine what modifications to make
    let numberOfRowsInSection = self.numberOfRows(inSection: indexPath.section)

    var shouldRoundTop = false
    var shouldRoundBottom = false

    if indexPath.row == 0 && indexPath.row == numberOfRowsInSection - 1 {
        // the cell is the only one in the section
        shouldRoundTop = true
        shouldRoundBottom = true
    } else if indexPath.row == 0 {
        // the cell is the first in the section
        shouldRoundTop = true
    } else if indexPath.row == numberOfRowsInSection - 1 {
        // the cell is the last in the section
        shouldRoundBottom = true
    }
}
```

Next, we’ll round the corners of the cell based on the calculations we just did. This is achieved using a `UIBezierPath` with our desired corner radius (12pt in this case to match the Wallet app).


```swift
func display(withRoundedSectionCorners cell: UITableViewCell, at indexPath: IndexPath) {
    // Determine what modifications to make
    // ...
    
    // Round corners if applicable
    if shouldRoundTop && shouldRoundBottom {
        cell.layer.cornerRadius = 10
        cell.layer.masksToBounds = true
    } else if shouldRoundTop || shouldRoundBottom {
        let shape = CAShapeLayer()
        let rect = CGRect(x: 0, y: 0, width: cell.bounds.width, height: cell.bounds.size.height)
        let corners: UIRectCorner = shouldRoundTop ? [.topLeft, .topRight] : [.bottomRight, .bottomLeft]

        shape.path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: 12, height: 12)).cgPath
        cell.layer.mask = shape
        cell.layer.masksToBounds = true
    }
}
```
Finally, we need to draw our own separator line for cells that are in the middle of a section, if the section has multiple rows.

```swift 
func display(withRoundedSectionCorners cell: UITableViewCell, at indexPath: IndexPath) {
    // Determine what modifications to make
    // ...
    
    // Round corners if applicable
    // ...
    
    // Show separator if applicable
    if numberOfRowsInSection > 1 && indexPath.row < numberOfRowsInSection - 1 {
        let bottomBorder = CALayer()
        bottomBorder.frame = CGRect(x: self.separatorInset.left, y: cell.bounds.maxY - 0.3, width: cell.contentView.frame.size.width, height: 0.3)
        bottomBorder.backgroundColor = self.separatorColor?.cgColor

        cell.contentView.layer.addSublayer(bottomBorder)
    }
}
```

Now we’re all set to implement this in our own table view! We can do so by calling `useRoundedSectionCorners()` on our table view in our view controller’s `viewDidLoad()`, and by calling `display(withRoundedSectionCorners:at:)` inside our table view delegate’s `tableView(_:willDisplay:forRowAt:)` method, like so:

```swift 
override func viewDidLoad() {
    super.viewDidLoad()
    
    // Add padding to the left and right sides
    self.tableView.snp.remakeConstraints { make in
        make.top.bottom.equalToSuperview()
        make.left.right.equalToSuperview().inset(16)
    }
    self.view.backgroundColor = self.tableView.backgroundColor
    
    // Enable rounded section corners
    self.tableView.useRoundedSectionCorners()
}

func tableView(_ tableView: UITableView, willDisplay cell: UITableViewCell, forRowAt indexPath: IndexPath) {
    tableView.display(withRoundedSectionCorners: cell, at: indexPath)
}
```

...and here’s our final result!

![Our recreation of the Wallet app’s table view as shown in SuperHomework](https://wgramer.files.wordpress.com/2019/02/img_4042.png?w=268&h=581)

Thanks for reading! If you want to try this out in your app, download the full code [here](https://gist.github.com/Wilsonator5000/67e1dd18cda7ab46d507a165d6d1bc42).
