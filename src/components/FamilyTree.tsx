import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface FamilyNode {
  name: string;
  children?: FamilyNode[];
  spouse?: string;
  title?: string;
}

const data: FamilyNode = {
  name: "Muhsin",
  title: "Leluhur Utama",
  children: [
    {
      name: "Abdullah",
      spouse: "Siti Aminah",
      children: [
        { name: "Ahmad", children: [{ name: "Zaid" }, { name: "Zainab" }] },
        { name: "Fathimah", spouse: "Ali", children: [{ name: "Hasan" }, { name: "Husain" }] }
      ]
    },
    {
      name: "Ibrahim",
      spouse: "Khadijah",
      children: [
        { name: "Yusuf", children: [{ name: "Yahya" }] },
        { name: "Maryam" }
      ]
    },
    {
      name: "Sulaeman",
      children: [
        { name: "Daud" },
        { name: "Sulaiman Jr" }
      ]
    }
  ]
};

export const FamilyTree: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 600;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", "auto")
      .style("font-family", "Cormorant Garamond");

    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tree = d3.tree<FamilyNode>().size([width - margin.left - margin.right, height - margin.top - margin.bottom]);
    const root = d3.hierarchy(data);
    tree(root);

    // Links
    g.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#5A5A40")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .attr("d", d3.linkVertical()
        .x(d => (d as any).x)
        .y(d => (d as any).y) as any);

    // Nodes
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
      .attr("transform", d => `translate(${d.x},${d.y})`);

    node.append("circle")
      .attr("r", 6)
      .attr("fill", "#5A5A40");

    node.append("text")
      .attr("dy", ".35em")
      .attr("y", d => d.children ? -20 : 20)
      .style("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "500")
      .text(d => d.data.name);

    if (root.data.title) {
       node.filter(d => d.depth === 0)
         .append("text")
         .attr("dy", "1.5em")
         .attr("y", -40)
         .style("text-anchor", "middle")
         .style("font-size", "10px")
         .style("text-transform", "uppercase")
         .style("letter-spacing", "1px")
         .style("opacity", 0.6)
         .text(root.data.title);
    }

  }, []);

  return (
    <div className="w-full overflow-x-auto bg-white/50 rounded-3xl p-8 border border-brand-olive/10 shadow-sm">
      <svg ref={svgRef}></svg>
    </div>
  );
};
