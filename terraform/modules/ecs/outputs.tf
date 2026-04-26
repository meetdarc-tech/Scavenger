output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "target_group_arn" {
  value = aws_lb_target_group.main.arn
}
